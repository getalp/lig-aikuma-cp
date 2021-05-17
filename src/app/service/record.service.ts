import {Injectable} from '@angular/core';

import {Filesystem, ReaddirResult, StatResult, Encoding} from '@capacitor/filesystem'
import {AikumaNative} from "../native";

import {computePath, getCommonOptions} from "../files";
import {deserializeRecord, Record, RecordType, serializeRecord} from "../record";
import {formatTwoDigit} from "../utils";


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
					encoding: Encoding.UTF8
				});

				const record = deserializeRecord(null, JSON.parse(recordRes.data));
				record.dirName = recordDir;
				record.dirPath = computePath([RecordService.RECORDS_DIR, recordDir]);
				record.basePath = basePath;
				record.dirUri = dirsStat.uri + "/" + recordDir;
				record.baseUri = record.dirUri + "/raw";

				try {
					await Filesystem.stat(getCommonOptions(record.getAacPath()));
					record.hasAudio = true;
				} catch (ignored) {}

				this.records[recordDir] = record;

			} catch (e) {
				console.warn("Invalid record directory: " + recordDir + " (it must contains valid raw.json).", e);
			}

		}

	}

	async ensureLoaded(): Promise<{ [key: string]: Record }> {
		if (this.records == null) {
			await this.load();
		}
		return this.records;
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
					...getCommonOptions(record.getMetaPath()),
					encoding: Encoding.UTF8,
					data: JSON.stringify(serializeRecord(record)),
					recursive: true
				});

				this.records[dir] = record;

				return;

			}

		}

		throw "Too much record directory with the same id.";

	}

	async deleteRecord(record: Record): Promise<void> {

		if (record.type !== RecordType.Raw || record.parent != null) {
			throw "You must use the raw record without parent to delete the directory.";
		}

		await Filesystem.rmdir({
			...getCommonOptions(record.dirPath),
			recursive: true
		});

		delete this.records[record.dirName];

	}

	async saveRecord(record: Record): Promise<void> {

		if (record.basePath == null) {
			throw "The record should have a base path";
		}

		await Filesystem.writeFile({
			...getCommonOptions(record.getMetaPath()),
			encoding: Encoding.UTF8,
			data: JSON.stringify(serializeRecord(record))
		});

	}

	async getRecord(dir: string): Promise<Record> {
		const record = (await this.ensureLoaded())[dir];
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
			return new RawRecorder(this, record);
		}
	}

	static getRecordDirName(record: Record): string {
		const date = record.date;
		return date.getFullYear() + "-" +
			formatTwoDigit(date.getMonth() + 1) + "-" +
			formatTwoDigit(date.getDate()) + "_" +
			formatTwoDigit(date.getHours()) + "-" +
			formatTwoDigit(date.getMinutes());
	}

	static getRealPathFromUri(uri: string): string {
		return uri.substring("file://".length);
	}

}


export class RawRecorder {

	private currentPath: string = null;
	private paused: boolean = true;

	constructor(
		private service: RecordService,
		private record: Record
	) { }

	isStarted(): boolean {
		return this.currentPath != null;
	}

	isPaused(): boolean {
		return this.currentPath == null || this.paused;
	}

	resume(): Promise<void> {
		if (this.isStarted()) {
			return AikumaNative.resumeRecording().then(() => {
				this.paused = false;
			});
		} else {
			const path = this.record.getAacUri();
			return AikumaNative.startRecording({
				path: path // URI are allowed and automatically converted to path if beginning with file://
			}).then(() => {
				this.currentPath = path;
				this.paused = false;
			}).catch(err => {
				console.warn("Failed to start recording: " + err);
				this.currentPath = null;
				if (err.message === "ALREADY_RECORDING") {
					return AikumaNative.stopRecording().then(() => this.resume());
				}
			});
		}
	}

	pause(): Promise<void> {
		if (this.isStarted()) {
			return AikumaNative.pauseRecording().then(() => {
				this.paused = true;
			});
		} else {
			return Promise.reject("not started");
		}
	}

	toggle(): Promise<void> {
		if (this.isPaused()) {
			return this.resume();
		} else {
			return this.pause();
		}
	}

	stop(): Promise<void> {
		if (this.isStarted()) {
			return AikumaNative.stopRecording().then(res => {
				this.currentPath = null;
				this.paused = true;
				this.record.hasAudio = true;
				this.record.duration = res.duration;
				return this.service.saveRecord(this.record).then(() => {
					console.log("Successfully saved record to: " + res.path + " (" + res.duration + "s)");
				});
			}).catch(err => {
				this.currentPath = null;
				this.paused = true;
				console.warn("Failed to stop recording: " + err);
			});
		} else {
			return Promise.reject();
		}
	}

	async getDuration(): Promise<number> {
		if (this.isStarted()) {
			return (await AikumaNative.getRecordDuration()).duration;
		} else {
			return 0;
		}
	}

}
