import {Injectable} from '@angular/core';

import {FilesystemEncoding, Plugins, ReaddirResult, StatResult} from '@capacitor/core';
const {Filesystem} = Plugins;

import {VoiceRecorderPlugin} from "capacitor-voice-recorder";
const VoiceRecorder: VoiceRecorderPlugin = Plugins.VoiceRecorder;

import {computePath, getCommonOptions} from "../files";
import {deserializeRecord, Record, RecordType, serializeRecord} from "../record";


@Injectable({
	providedIn: 'root'
})
export class RecordService {

	private static readonly RECORDS_DIR = "records";

	private records: { [key: string]: Record } = null;

	constructor() { }

	async load() {

		this.records = {};

		let dirsRes: ReaddirResult;
		let dirsStat: StatResult;

		try {
			dirsRes = await Filesystem.readdir(getCommonOptions([RecordService.RECORDS_DIR]));
			dirsStat = await Filesystem.stat(getCommonOptions([RecordService.RECORDS_DIR]));
		} catch (e) {
			console.warn("Can't load records because directory does not exists.");
			return;
		}

		for (let recordDir of dirsRes.files) {

			try {

				const basePath = computePath([RecordService.RECORDS_DIR, recordDir, "raw"]);

				// Ensure that the audio is present before decoding metadata.
				// FIXME: No longer checking for audio file.
				// await Filesystem.stat(getCommonOptions(basePath + ".wav"));

				const recordRes = await Filesystem.readFile({
					...getCommonOptions(basePath + ".json"),
					encoding: FilesystemEncoding.UTF8
				});

				const record = deserializeRecord(null, JSON.parse(recordRes.data));
				record.dirName = recordDir;
				record.dirPath = computePath([RecordService.RECORDS_DIR, recordDir]);
				record.basePath = basePath;
				record.dirUri = dirsStat.uri + "/" + recordDir;
				record.baseUri = record.dirUri + "/raw";

				this.records[recordDir] = record;

			} catch (e) {
				console.warn("Invalid record directory: " + recordDir + " (it must contains valid raw.json).", e);
			}

		}

	}

	async ensureLoaded() {
		if (this.records == null) {
			await this.load();
		}
	}

	async newRawRecord(record: Record) {

		if (record.type !== RecordType.Raw || record.parent != null) {
			throw "You can only use this function for raw records, without parent.";
		}

		await this.ensureLoaded();

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

				const res = await Filesystem.getUri(getCommonOptions(dirPath));

				record.dirName = dir;
				record.dirPath = dirPath;
				record.basePath = computePath([RecordService.RECORDS_DIR, dir, "raw"]);
				record.dirUri = res.uri;
				record.baseUri = record.dirUri + "/raw";

				await Filesystem.writeFile({
					...getCommonOptions(record.basePath + ".json"),
					encoding: FilesystemEncoding.UTF8,
					data: JSON.stringify(serializeRecord(record)),
					recursive: true
				});

				this.records[dir] = record;

				return;

			}

		}

		throw "Too much record directory with the same id.";

	}

	async getRecord(dir: string): Promise<Record> {
		await this.ensureLoaded();
		const record = this.records[dir];
		if (record == null) {
			throw `Invalid record directory '${dir}'.`;
		} else {
			return record;
		}
	}

	async beginRawRecord(record: Record): Promise<RawRecorder> {
		if (record.baseUri == null) {
			throw "The record must be linked and initialized by the RecordService before beginning record.";
		} else {
			return new RawRecorder(record/*, this.media*/);
		}
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

	static getRealPathFromUri(uri: string): string {
		return uri.substring("file://".length);
	}

}


export class RawRecorder {

	private currentPath: string;

	private idx: number = 0;
	private files: string[] = [];

	constructor(private record: Record) { }

	start() {
		const path = this.record.getAacPath(this.idx++);
		VoiceRecorder.startRecording().then(_res => { // Ignore res, res.value always true
			this.currentPath = path;
		}).catch(err => {
			console.warn("Failed to start recording: " + err);
			this.currentPath = null;
		});
	}

	stop() {
		if (this.currentPath != null) {
			VoiceRecorder.stopRecording().then(res => {
				return Filesystem.writeFile({
					...getCommonOptions(this.currentPath),
					data: res.value.recordDataBase64
				});
			}).then(res => {
				this.files.push(this.currentPath);
				this.currentPath = null;
				console.log("Successfully saved record to: " + res.uri);
			}).catch(err => {
				this.currentPath = null;
				console.warn("Failed to stop recording: " + err);
			});
		}
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



