import {Injectable} from '@angular/core';

import {Encoding, Filesystem, ReaddirResult, StatResult} from '@capacitor/filesystem'
import {AikumaNative, ConcatAudioSegment} from "../native";
import {KeepAwake} from "@capacitor-community/keep-awake";

import {computePath, getCommonOptions, ROOT} from "../files";
import {deserializeRecord, Record, RecordSerialized, RecordType, serializeRecord} from "../record";
import {formatTwoDigit} from "../utils";


@Injectable({
	providedIn: 'root'
})
export class RecordService {

	private static readonly RECORDS_DIR = "records";

	private records: { [key: string]: Record } = null;

	constructor() {

		/*LocalNotifications.registerActionTypes({
			types: [
				{
					id: "audio_record",
					actions: [
						{
							id: "pause",
							title: "Pause"
						}
					]
				}
			]
		}).then();*/

	}

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

		const recordsWithParent: [Record, string][] = [];

		for (let recordDir of dirsRes.files) {

			try {

				const dirPath = computePath([RecordService.RECORDS_DIR, recordDir]);

				const metaPath = Record.getMetaPathFromDirPath(dirPath);

				// Legacy compatibility loading
				try {
					const legacyMetaPath = dirPath + "/raw.json";
					await Filesystem.rename({from: legacyMetaPath, to: metaPath, directory: ROOT});
				} catch (ignored) {}

				try {
					const legacyAudioPath = dirPath + "/raw.aac";
					const newAudioPath = dirPath + "/audio.aac";
					await Filesystem.rename({from: legacyAudioPath, to: newAudioPath, directory: ROOT});
				} catch (ignored) {}

				const recordRes = await Filesystem.readFile({
					...getCommonOptions(metaPath /*basePath + ".json"*/),
					encoding: Encoding.UTF8
				});

				const recordSerialized = <RecordSerialized>JSON.parse(recordRes.data);
				const record = deserializeRecord(recordSerialized);
				record.dirName = recordDir;
				record.dirPath = computePath([RecordService.RECORDS_DIR, recordDir]);
				record.dirUri = dirsStat.uri + "/" + recordDir;

				if (recordSerialized.parent != null) {
					recordsWithParent.push([record, recordSerialized.parent]);
				}

				try {
					await Filesystem.stat(getCommonOptions(record.getAudioPath()));
					record.hasAudio = true;
				} catch (ignored) {}

				this.records[recordDir] = record;

			} catch (e) {
				console.warn("Invalid record directory: " + recordDir + " (it must contains valid raw.json).", e);
			}

		}

		for (let [record, parentRecordDir] of recordsWithParent) {
			record.parent = this.records[parentRecordDir] ?? null;
			record.parent.children.push(record);
		}

	}

	async ensureLoaded(): Promise<{ [key: string]: Record }> {
		if (this.records == null) {
			await this.load();
		}
		return this.records;
	}

	async initRecord(record: Record) {

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
				record.dirUri = res.uri;

				if (record.parent != null) {
					record.parent.children.push(record);
				}

				await this.saveRecord(record);

				this.records[dir] = record;
				return;

			}

		}

		throw "Too much record directory with the same id.";

	}

	async deleteRecord(record: Record): Promise<void> {

		await Filesystem.rmdir({
			...getCommonOptions(record.dirPath),
			recursive: true
		});

		delete this.records[record.dirName];

		if (record.parent != null) {
			const idx = record.parent.children.indexOf(record);
			if (idx != null) {
				record.parent.children.splice(idx, 1);
			}
		}

	}

	async saveRecord(record: Record): Promise<void> {

		if (!record.wasPathLoaded()) {
			throw "The record was not loaded from file system.";
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
		if (!record.wasPathLoaded()) {
			throw "The record was not loaded from file system.";
		} else if (record.type !== RecordType.Raw) {
			throw "The record is not raw.";
		} else {
			return new RawRecorder(this, record);
		}
	}

	async beginRespeakingRecord(record: Record): Promise<RespeakingRecorder> {
		if (!record.wasPathLoaded()) {
			throw "The record was not loaded from file system.";
		} else if (record.type !== RecordType.Respeaking) {
			throw "The record is not a respeaking.";
		} else if (record.parent == null) {
			throw "The record need a parent.";
		} else if (!record.parent.hasAnyMarker()) {
			throw "The record need a parent with at least 1 marker.";
		} else if (!record.parent.hasAudio) {
			throw "The record need a parent with an audio.";
		} else {
			return new RespeakingRecorder(this, record);
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
	//private notificationId: number | null = null;

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
				KeepAwake.keepAwake().then();
				this.paused = false;
			});
		} else {
			const path = this.record.getAudioUri();
			return AikumaNative.startRecording({
				path: path, // URI are allowed and automatically converted to path if beginning with file://
				cancelLast: true
			}).then(() => {
				this.currentPath = path;
				this.paused = false;
				KeepAwake.keepAwake().then();
				/*return LocalNotifications.schedule({
					notifications: [
						{
							title: "LIG Aikuma is recording",
							body: "Recording LIG Aikuma",
							id: Math.floor(Math.random() * 100000),
							actionTypeId: "audio_record",
							ongoing: true,
							autoCancel: false
						}
					]
				}).then(res => {
					this.notificationId = res.notifications[0].id;
				});*/
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
				KeepAwake.allowSleep().then();
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
				KeepAwake.allowSleep().then();
				this.currentPath = null;
				this.paused = true;
				this.record.hasAudio = true;
				this.record.duration = res.duration;
				/*if (this.notificationId != null) {
					LocalNotifications.cancel({
						notifications: [
							{
								id: this.notificationId
							}
						]
					}).then();
				}*/
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


export class RespeakingRecorder {

	private currentMarkerIndex: number | null = null;
	private tempRecords: RespeakingTempRecord[] = [];
	private paused: boolean = true;

	constructor(
		private service: RecordService,
		private record: Record
	) {
		for (let i = 0; i < this.record.parent.markers.length; ++i) {
			this.tempRecords.push(null);
		}
	}

	/**
	 * If started, return the index of the marker which is being respeaked.
	 */
	isStarted(): number | null {
		return this.currentMarkerIndex;
	}

	isPaused(): boolean {
		return this.currentMarkerIndex == null || this.paused;
	}

	getTempRecord(markerIndex: number): RespeakingTempRecord {
		return this.tempRecords[markerIndex];
	}

	getTempRecordCount(): number {
		return this.tempRecords.filter(record => (record != null)).length;
	}

	private checkMarkerIndex(index: number) {
		if (index < 0 || index >= this.record.parent.markers.length) {
			throw "Invalid marker index.";
		}
	}

	async resumeRecording(markerIndex: number) {

		if (this.currentMarkerIndex === markerIndex) {
			await AikumaNative.resumeRecording();
			KeepAwake.keepAwake().then();
			this.paused = false;
		} else {

			this.checkMarkerIndex(markerIndex);

			if (this.currentMarkerIndex != null) {
				// await this.stopRecording(this.currentMarkerIndex);
				throw "Another marker is being recording.";
			}

			try {
				await AikumaNative.startRecording({
					path: this.record.getTempAudioUri(markerIndex),
					cancelLast: true
				});
				KeepAwake.keepAwake().then();
			} catch (err) { }

			this.currentMarkerIndex = markerIndex;
			this.paused = false;

		}

	}

	async pauseRecording(markerIndex: number) {
		if (this.currentMarkerIndex === markerIndex) {
			await AikumaNative.pauseRecording();
			KeepAwake.allowSleep().then();
			this.paused = true;
		} else {
			throw "Not recording";
		}
	}

	async toggleRecording(markerIndex: number) {
		if (this.currentMarkerIndex !== markerIndex || this.paused) {
			await this.resumeRecording(markerIndex);
		} else {
			await this.pauseRecording(markerIndex);
		}
	}

	async stopRecording(markerIndex: number, abort: boolean) {
		if (this.currentMarkerIndex === markerIndex) {
			this.paused = true;
			this.currentMarkerIndex = null;
			const info = await AikumaNative.stopRecording();
			KeepAwake.allowSleep().then();
			const uri = "file://" + info.path;
			if (abort) {
				await Filesystem.deleteFile({
					path: uri
				});
				this.tempRecords[markerIndex] = null;
				console.log("Aborted marker record for " + markerIndex + ", deleted record at '" + info.path + "'.");
			} else {
				this.tempRecords[markerIndex] = { uri: uri, duration: info.duration };
				console.log("Saved marker record for " + markerIndex + " (path: " + info.path + ", duration: " + info.duration.toFixed(2) + ")");
			}
		} else {
			throw "Not recording.";
		}
	}

	async resetRecording(markerIndex: number) {

		if (this.currentMarkerIndex === markerIndex) {
			throw "This marker is being recorder.";
		}

		const tempRecord = this.tempRecords[markerIndex];
		if (tempRecord != null) {
			try {
				await Filesystem.deleteFile({ path: tempRecord.uri });
			} catch (ignored) {}
			this.tempRecords[markerIndex] = null;
		}

	}

	async saveRespeaking() {

		const segments: ConcatAudioSegment[] = [];
		const recordAudioUri = this.record.parent.getAudioUri();

		let parentStartTime = 0;
		let totalTime = 0;

		this.record.clearMarkers();

		for (let markerIndex = 0; markerIndex < this.tempRecords.length; ++markerIndex) {
			const tempRecord = this.tempRecords[markerIndex];
			if (tempRecord != null) {

				const marker = this.record.parent.markers[markerIndex];

				totalTime += marker.start - parentStartTime;
				this.record.addMarker(totalTime, totalTime + tempRecord.duration);
				totalTime += tempRecord.duration;

				segments.push({
					path: recordAudioUri,
					from: parentStartTime,
					to: marker.start
				});

				segments.push({
					path: tempRecord.uri,
					from: -1,
					to: -1
				});

				parentStartTime = marker.end;

			}
		}

		totalTime += this.record.parent.duration - parentStartTime;

		segments.push({
			path: recordAudioUri,
			from: parentStartTime,
			to: -1
		});

		await AikumaNative.concatAudioAcc({
			path: this.record.getAudioUri(),
			segments: segments
		});

		this.record.markersReady = true;
		this.record.hasAudio = true;
		this.record.duration = totalTime;

		await this.service.saveRecord(this.record);

	}

}


export interface RespeakingTempRecord {
	uri: string;
	duration: number;
}
