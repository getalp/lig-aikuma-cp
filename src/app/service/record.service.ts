import {Injectable} from '@angular/core';

import {FilesystemEncoding, Plugins} from '@capacitor/core';
const {Filesystem} = Plugins;

import {getReadOptions, getWriteOptions} from "../files";
import {Record} from "../record";


@Injectable({
	providedIn: 'root'
})
export class RecordService {

	private record: Record;

	constructor() { }

	setup(record: Record) {
		this.record = record;
	}

	resume() {

	}

	pause() {

	}

}


interface RecordHandler {
	supported(): boolean;
	start(): void;
	pause(): void;
	resume(): void;
}

class NavigatorRecordHandler implements RecordHandler {

	private mediaStream: Promise<MediaStream>;


	constructor() {

	}

	supported(): boolean {
		return navigator.mediaDevices != null && navigator.mediaDevices.getUserMedia != null;
	}

	private ensureMediaStream(): Promise<MediaStream> {
		if (this.mediaStream) {
			this.mediaStream = navigator.mediaDevices.getUserMedia({
				audio: true
			});
		}
		return this.mediaStream;
	}

	private ensureMediaRecorder(): Promise<MediaRecorder> {
		return this.ensureMediaStream().then(stream => {
			return new MediaRecorder(stream);
		});
	}

	start(): void {
		this.ensureMediaRecorder().then(recorder => {
			recorder.start();
		})
	}

	pause(): void {
	}

	resume(): void {
	}

}

