import {Injectable} from '@angular/core';

import {Filesystem, ReaddirResult, StatResult, Encoding} from '@capacitor/filesystem'
import {AikumaNative} from "../native";

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
					encoding: Encoding.UTF8
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
		const path = this.record.getAacUri(this.idx++);
		AikumaNative.startRecording({
			path: path
		}).then(() => {
			this.currentPath = path;
		}).catch(err => {
			console.warn("Failed to start recording: " + err);
			this.currentPath = null;
		});
		/*VoiceRecorder.startRecording().then(_res => { // Ignore res, res.value always true
			this.currentPath = path;
		}).catch(err => {
			console.warn("Failed to start recording: " + err);
			this.currentPath = null;
		});*/
	}

	stop() {
		if (this.currentPath != null) {
			AikumaNative.stopRecording().then(res => {
				this.files.push(this.currentPath);
				this.currentPath = null;
				console.log("Successfully saved record to: " + res.path);
			}).catch(err => {
				this.currentPath = null;
				console.warn("Failed to stop recording: " + err);
			});
			/*VoiceRecorder.stopRecording().then(res => {
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
			});*/
		}
	}

}
