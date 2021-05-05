import {Injectable} from '@angular/core';

import {FilesystemEncoding, Plugins} from '@capacitor/core';
const {Filesystem} = Plugins;

import {getReadOptions, getWriteOptions} from "../files";
import {Record} from "../record";


@Injectable({
	providedIn: 'root'
})
export class RecordService {

	private readonly handlers: RecordHandlerFactory<RecordHandler>[] = [
		new NavigatorRecordHandlerFactory()
	];

	private handler: RecordHandler = null;
	private noHandler: boolean = false;

	private record: Record = null;

	private started: boolean = false;
	private recording: boolean = false;

	constructor() { }

	private checkNoHandler() {
		if (this.noHandler) {
			throw "No recording handler was found.";
		}
	}

	private checkSetup() {
		if (this.handler == null) {
			throw "The service must be set up before using it.";
		}
	}

	setup(record: Record) {

		this.checkNoHandler();

		if (this.handler == null) {
			for (let handler of this.handlers) {
				this.handler = handler.try_new();
				if (this.handler != null) {
					break;
				}
			}
			if (this.handler == null) {
				this.noHandler = true;
				this.checkNoHandler();
			}
		}

		this.record = record;
		this.started = false;
		this.recording = false;

	}

	resume() {
		this.checkSetup();
		if (!this.recording) {
			if (this.started) {
				this.handler.resume();
			} else {
				this.handler.start().then();
			}
		}
	}

	pause() {
		this.checkSetup();
		if (this.recording) {
			this.handler.pause();
		}
	}

	stop() {
		if (this.recording) {
			this.pause();
		}
		this.checkSetup();
		this.handler.stop();
		this.started = false;
		this.recording = false;
		this.record = null;
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

interface RecordHandlerFactory<T extends RecordHandler> {
	try_new(): T | null;
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

class NavigatorRecordHandlerFactory implements RecordHandlerFactory<NavigatorRecordHandler> {

	try_new(): NavigatorRecordHandler | null {
		console.log("navigator: " + JSON.stringify(navigator.mediaDevices))
		if (navigator.mediaDevices != null && navigator.mediaDevices.getUserMedia != null) {
			return new NavigatorRecordHandler(navigator.mediaDevices);
		} else {
			return null;
		}
	}

}


// CORDOVA SUPPORT (preferred) //
