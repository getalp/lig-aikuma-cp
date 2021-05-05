import {Injectable} from '@angular/core';

import {FilesystemEncoding, Plugins} from '@capacitor/core';
const {Filesystem} = Plugins;

import {Media, MediaObject} from '@ionic-native/media/ngx';

import {getStatOptions, getMkdirOptions} from "../files";
import {Record} from "../record";


@Injectable({
	providedIn: 'root'
})
export class RecordService {

	private static readonly RECORDS_DIR = "records";

	//private handler: RecordHandler = null;
	// private noHandler: boolean = false;

	private record: Record = null;

	private recordObject: MediaObject;
	private started: boolean = false;
	private recording: boolean = false;

	constructor(
		private media: Media
	) { }

	static formatTwoDigit(num: number): string {
		return (num < 10 ? "0" : "") + num.toString();
	}

	static getRecordDirName(record: Record): string {
		const date = record.date;
		return date.getFullYear() + "-" +
			this.formatTwoDigit(date.getMonth() + 1) + "-" +
			this.formatTwoDigit(date.getDate()) + "_" +
			this.formatTwoDigit(date.getHours()) + "-" +
			this.formatTwoDigit(date.getMinutes());
	}

	static async findNewRecordDir(record: Record): Promise<string> {

		const dirRaw = this.getRecordDirName(record);
		let dir = dirRaw;
		let dirId = 0;

		for (let i = 0; i < 100; ++i) {

			try {
				await Filesystem.stat(getStatOptions([this.RECORDS_DIR, dir]));
				dir = dirRaw + "_" + (++dirId).toString();
			} catch (e) {
				await Filesystem.mkdir(getMkdirOptions([this.RECORDS_DIR, dir]));
				const stat = await Filesystem.stat(getStatOptions([this.RECORDS_DIR, dir]));
				return stat.uri.substring("file://".length);
			}

		}

		throw "Too much record directory with the same id.";

	}

	setup(record: Record) {

		RecordService.findNewRecordDir(record).then(path => {
			this.recordObject = this.media.create(path + "/raw.wav");
		});

		/*this.checkNoHandler();

		if (this.handler == null) {

			if (navigator.mediaDevices != null && navigator.mediaDevices.getUserMedia != null) {
				this.handler = new NavigatorRecordHandler(navigator.mediaDevices);
			} else {
				this.noHandler = true;
				this.checkNoHandler();
			}

		}*/

		this.record = record;
		//this.started = false;
		//this.recording = false;

	}

	resume() {
		/*this.checkSetup();
		if (!this.recording) {
			if (this.started) {
				this.handler.resume();
			} else {
				this.handler.start();
			}
		}*/
	}

	pause() {
		/*this.checkSetup();
		if (this.recording) {
			this.handler.pause();
		}*/
	}

	stop() {
		/*if (this.recording) {
			this.pause();
		}
		this.checkSetup();
		this.handler.stop();
		this.started = false;
		this.recording = false;
		this.record = null;*/
	}

}


interface RecordHandler {

	getState(): RecordState;
	getDuration(): number;

	start();
	pause();
	resume();
	stop();

}

enum RecordState {
	INACTIVE,
	PAUSED,
	RECORDING
}

// NAVIGATOR SUPPORT (preferred) //

class NavigatorRecordHandler implements RecordHandler {

	private mediaStream: Promise<MediaStream>;
	private recorder: MediaRecorder;
	private currentTime: number;
	private startTime: number;

	constructor(devices: MediaDevices) {
		this.mediaStream = devices.getUserMedia({
			audio: true
		});
	}

	getState(): RecordState {
		if (this.recorder == null) {
			return RecordState.INACTIVE;
		} else {
			switch (this.recorder.state) {
				case "inactive":
					return RecordState.INACTIVE;
				case "paused":
					return RecordState.PAUSED;
				case "recording":
					return RecordState.RECORDING;
			}
		}
	}

	getDuration(): number {
		return this.currentTime + (this.startTime === 0 ? 0 : (Date.now() - this.startTime));
	}

	start() {
		this.mediaStream.then(stream => {
			this.recorder = new MediaRecorder(stream);
			this.recorder.ondataavailable = null;
			this.recorder.start();
			this.currentTime = 0;
			this.startTime = Date.now();
		});
	}

	pause() {
		if (this.recorder != null && this.recorder.state === "recording") {
			this.recorder.pause();
			this.currentTime += Date.now() - this.startTime;
			this.startTime = 0;
		}
	}

	resume() {
		if (this.recorder != null && this.recorder.state === "paused") {
			this.recorder.resume();
			this.startTime = Date.now();
		}
	}

	stop() {
		if (this.recorder != null && this.recorder.state !== "inactive") {
			this.recorder.stop();
			if (this.startTime !== 0) {
				this.currentTime += Date.now() - this.startTime;
				this.startTime = 0;
			}
			this.recorder = null;
		}
	}

}


// CORDOVA SUPPORT (preferred) //

class CordovaRecordHandler implements RecordHandler {

	private currentTime: number;
	private startTime: number;

	getState(): RecordState {
		return undefined;
	}

	getDuration(): number {
		return 0;
	}

	start() {

	}

	pause() {

	}

	resume() {
	}

	stop() {
	}

}
