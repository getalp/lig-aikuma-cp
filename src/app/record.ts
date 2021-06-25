import {deserializeSpeaker, serializeSpeaker, Speaker, SpeakerSerialized} from "./speaker";


export class Record {

	public notes: string = "";
	public date: Date = new Date();
	public duration: number | null = null;

	public dirName: string = null;
	public dirPath: string = null;
	//public basePath: string = null;
	public dirUri: string = null;
	//public baseUri: string = null;

	public hasAudio: boolean = false;

	public markersReady: boolean = false;
	public markers: RecordMarker[] = [];

	public children: Record[] = [];

	constructor(
		public parent: Record,
		public speaker: Speaker,
		public language: string,
		public type: RecordType
	) { }

	isRoot(): boolean {
		return this.parent == null;
	}

	isDerived(): boolean {
		return !this.isRoot();
	}

	wasPathLoaded(): boolean {
		return this.dirName != null;
	}

	getMetaPath(): string {
		// return this.basePath + ".json";
		return Record.getMetaPathFromDirPath(this.dirPath);
	}

	getAudioPath(): string {
		return this.dirPath + "/audio.aac";
	}

	getAudioUri(): string {
		return this.dirUri + "/audio.aac";
	}

	getTempAudioPath(id: number): string {
		return this.dirPath + "/audio-tmp" + id + ".aac";
	}

	/*getAacPath(): string {
		return this.basePath + ".aac";
	}

	getAacUri(): string {
		return this.baseUri + ".aac";
	}*/

	clearMarkers() {
		this.markers.splice(0, this.markers.length);
	}

	/*copyMarkersTo(other: Record) {
		other.clearMarkers();
		other.markers.push(...this.markers);
	}*/

	addMarker(start: number, end: number) {
		this.markers.push(new RecordMarker(start, end));
	}

	hasAnyMarker(): boolean {
		return this.markersReady && this.markers.length !== 0;
	}

	static getMetaPathFromDirPath(dirPath: string): string {
		return dirPath + "/meta.json";
	}

}


export enum RecordType {
	Raw = "raw",
	Respeaking = "respeaking",
}


export class RecordMarker {

	constructor(
		public start: number,
		public end: number
	) { }

}


export interface RecordSerialized {
	"parent": string | null,
	"speaker": SpeakerSerialized,
	"language": string,
	"type": string,
	"date": string,
	"notes": string,
	"duration": number | null,
	"markers_ready": boolean,
	"markers": {
		"start": number,
		"end": number
	}[]
}


export function serializeRecord(record: Record): RecordSerialized {
	return {
		"parent": (record.parent == null) ? null : record.parent.dirName,
		"speaker": serializeSpeaker(record.speaker),
		"language": record.language,
		"type": record.type,
		"date": record.date.toISOString(),
		"notes": record.notes,
		"duration": record.duration,
		"markers_ready": record.markersReady,
		"markers": record.markers.map(m => {
			return { "start": m.start, "end": m.end };
		})
	};
}


export function deserializeRecord(/*parent: Record, */raw: RecordSerialized): Record {
	const speaker = deserializeSpeaker(null, raw["speaker"]);
	const record = new Record(/*parent, */ null, speaker, raw["language"], <RecordType>raw["type"]);
	record.date = new Date(raw["date"]);
	record.notes = raw["notes"];
	record.duration = raw["duration"];
	record.markersReady = Boolean(raw["markers_ready"]);
	if (Array.isArray(raw["markers"])) {
		raw["markers"].forEach(m => record.markers.push(new RecordMarker(m["start"], m["end"])));
	}
	return record;
}
