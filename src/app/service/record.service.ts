import {Injectable} from '@angular/core';

import {FilesystemEncoding, Plugins} from '@capacitor/core';
import {Media, MediaObject} from '@ionic-native/media/ngx';

import {computePath, getCommonOptions} from "../files";
import {deserializeRecord, Record, RecordType} from "../record";

const {Filesystem} = Plugins;


@Injectable({
	providedIn: 'root'
})
export class RecordService {

	private static readonly RECORDS_DIR = "records";

	// private handler: RecordHandler = null;
	// private noHandler: boolean = false;

	// private record: Record = null;
	private records: { [key: string]: Record } = {};

	private recordObject: MediaObject;
	private started: boolean = false;
	private recording: boolean = false;

	constructor(
		private media: Media
	) { }

	async load() {

		this.records = {};

		const dirsRes = await Filesystem.readdir(getCommonOptions([RecordService.RECORDS_DIR]));
		const dirsStat = await Filesystem.stat(getCommonOptions([RecordService.RECORDS_DIR]));

		for (let recordDir of dirsRes.files) {

			try {

				const basePath = computePath([RecordService.RECORDS_DIR, recordDir, "raw"]);

				// Ensure that the audio is present before decoding metadata.
				await Filesystem.stat(getCommonOptions(basePath + ".wav"));

				const recordRes = await Filesystem.readFile({
					...getCommonOptions(basePath + ".json"),
					encoding: FilesystemEncoding.UTF8
				});

				const record = deserializeRecord(null, JSON.parse(recordRes.data));
				record.dirPath = computePath([RecordService.RECORDS_DIR, recordDir]);
				record.basePath = computePath([RecordService.RECORDS_DIR, recordDir, "raw"]);
				record.dirRealPath = dirsStat.uri.substring("file://".length) + "/" + recordDir;

				this.records[recordDir] = record;

			} catch (ignored) { }

		}

	}

	async newRawRecord(record: Record): Promise<void> {

		if (record.type !== RecordType.Raw || record.parent != null) {
			throw "You can only use this function for raw records, without parent.";
		}

		const dirRaw = RecordService.getRecordDirName(record);
		let dir = dirRaw;
		let dirId = 0;
		let dirPath = computePath([RecordService.RECORDS_DIR, dir]);

		for (let i = 0; i < 100; ++i) {

			try {

				await Filesystem.stat(getCommonOptions(dirPath));
				dir = dirRaw + "_" + (++dirId).toString();
				dirPath = computePath([RecordService.RECORDS_DIR, dir]);

			} catch (e) {

				await Filesystem.mkdir({
					...getCommonOptions(dirPath),
					recursive: true
				});

				const res = await Filesystem.stat(getCommonOptions(dirPath));

				record.dirPath = dirPath;
				record.basePath = computePath([RecordService.RECORDS_DIR, dir, "raw"]);
				record.dirRealPath = res.uri.substring("file://".length);

				this.records[dir] = record;

			}

		}

		throw "Too much record directory with the same id.";

	}





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

	/*static async findNewRecordDir(record: Record): Promise<string> {

		const dirRaw = this.getRecordDirName(record);
		let dir = dirRaw;
		let dirId = 0;

		for (let i = 0; i < 100; ++i) {

			try {
				await Filesystem.stat(getCommonOptions([this.RECORDS_DIR, dir]));
				dir = dirRaw + "_" + (++dirId).toString();
			} catch (e) {
				await Filesystem.mkdir({
					...getCommonOptions([this.RECORDS_DIR, dir]),
					recursive: true
				});
				const res = await Filesystem.stat(getCommonOptions([this.RECORDS_DIR, dir]));
				return res.uri.substring("file://".length);
			}

		}

		throw "Too much record directory with the same id.";

	}*/

















	setup(record: Record) {

		/*RecordService.findNewRecordDir(record).then(path => {
			this.recordObject = this.media.create(path + "/raw.wav");
		});*/

		/*this.checkNoHandler();

		if (this.handler == null) {

			if (navigator.mediaDevices != null && navigator.mediaDevices.getUserMedia != null) {
				this.handler = new NavigatorRecordHandler(navigator.mediaDevices);
			} else {
				this.noHandler = true;
				this.checkNoHandler();
			}

		}*/

		//this.record = record;
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


/*interface RecordHandler {

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
*/



