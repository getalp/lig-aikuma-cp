import {WebPlugin} from '@capacitor/core';

import type {NativePlugin, RecordOptions, RecordInfo, RecordDuration, ConcatAudioOptions} from './definitions';
import {Filesystem} from "@capacitor/filesystem";
import {blobToBase64} from "../utils";

export class NativePluginWeb extends WebPlugin implements NativePlugin {

	private readonly mediaType = "video/webm";

	private stream: MediaStream;
	private recorder: MediaRecorder;
	private path: string;

	private recorderChunks: Blob[];
	private durationPromise: Promise<number>;

	private totalTime: number = 0;
	private startTime: number = 0;

	private durationIntervalHandle: number;

	async startRecording(options: RecordOptions): Promise<void> {

		if (navigator.mediaDevices == null || window.MediaRecorder == null || !MediaRecorder.isTypeSupported(this.mediaType)) {
			throw "NOT_SUPPORTED";
		}

		if (this.stream != null) {
			// TODO: Handle 'options.cancelLast'.
			throw "ALREADY_RECORDING";
		}

		try {
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false
			});
		} catch (e) {
			throw "MISSING_PERMISSION";
		}

		this.recorder = new MediaRecorder(this.stream, {
			mimeType: this.mediaType
		});

		this.recorder.onstart = () => {

			this.totalTime = 0;
			this.resumeDuration();

			this.durationIntervalHandle = window.setInterval(() => {
				if (this.recorder.state !== "paused") {
					this.notifyDurationListeners();
				}
			}, 100);

		};

		this.recorder.onpause = () => {
			this.pauseDuration();
			this.notifyDurationListeners();
		};

		this.recorder.onresume = () => {
			this.resumeDuration();
		};

		this.durationPromise = new Promise(resolve => {
			this.recorder.onstop = () => {

				window.clearInterval(this.durationIntervalHandle);
				this.durationIntervalHandle = null;

				const duration = this.getDuration();
				this.totalTime = null;
				this.startTime = 0;
				resolve(duration);

			};
		});

		this.recorder.ondataavailable = (event) => {
			this.recorderChunks.push(event.data);
		};

		this.path = options.path;
		this.recorderChunks = [];

		this.recorder.start();

	}

	async pauseRecording(): Promise<void> {
		if (this.recorder != null) {
			if (this.recorder.state !== "paused") {
				this.recorder.pause();
			}
		} else {
			throw "NOT_RECORDING";
		}
	}

	async resumeRecording(): Promise<void> {
		if (this.recorder != null) {
			if (this.recorder.state === "paused") {
				this.recorder.resume();
			}
		} else {
			throw "NOT_RECORDING";
		}
	}

	async stopRecording(): Promise<RecordInfo> {
		if (this.recorder != null) {

			this.recorder.stop();

			const duration = await this.durationPromise;

			for (let audioTrack of this.stream.getAudioTracks()) {
				audioTrack.stop();
			}

			this.recorder = null;
			this.stream = null;

			const path = this.path;
			this.path = null;
			this.notifyDurationListeners();


			const data = new Blob(this.recorderChunks, {
				type: this.mediaType
			});

			await Filesystem.writeFile({
				path: path,
				data: (await blobToBase64(data))
			});

			return { duration: duration, path: path };

		} else {
			throw "NOT_RECORDING";
		}
	}

	async getRecordDuration(): Promise<RecordDuration> {
		if (this.recorder != null) {
			return { duration: this.getDuration() };
		} else {
			throw "NOT_RECORDING";
		}
	}

	concatAudioAcc(options: ConcatAudioOptions): Promise<void> {
		return Promise.reject("Not implemented");
	}

	// Private //

	private pauseDuration() {
		this.totalTime += Date.now() - this.startTime;
		this.startTime = 0;
	}

	private resumeDuration() {
		this.startTime = Date.now();
	}

	private getDuration(): number {
		if (this.startTime === 0) {
			return this.totalTime / 1000;
		} else {
			return (this.totalTime + Date.now() - this.startTime) / 1000;
		}
	}

	private notifyDurationListeners() {
		this.notifyListeners("recordDuration", { duration: this.getDuration() });
	}

}
