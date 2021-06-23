import {deserializeSpeaker, serializeSpeaker, Speaker, SpeakerSerialized} from "./speaker";


export class Record {

	public notes: string = "";
	public date: Date = new Date();
	public duration: number | null = null;

	public dirName: string = null;
	public dirPath: string = null;
	public basePath: string = null;
	public dirUri: string = null;
	public baseUri: string = null;

	public hasAudio: boolean = false;

	public markersReady: boolean = false;
	public markers: RecordMarker[] = [];

	constructor(
		public parent: Record,
		public speaker: Speaker,
		public language: string,
		public type: RecordType
	) { }

	static newRaw(speaker: Speaker, language: string): Record {
		return new Record(null, speaker, language, RecordType.Raw);
	}

	isRoot(): boolean {
		return this.parent == null;
	}

	isDerived(): boolean {
		return !this.isRoot();
	}

	getMetaPath(): string {
		return this.basePath + ".json";
	}

	getAacPath(): string {
		return this.basePath + ".aac";
	}

	getAacUri(): string {
		return this.baseUri + ".aac";
	}

	clearMarkers() {
		this.markers.splice(0, this.markers.length);
	}

	addMarker(start: number, end: number) {
		this.markers.push(new RecordMarker(start, end));
	}

	hasAnyMarker(): boolean {
		return this.markersReady && this.markers.length !== 0;
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


export function deserializeRecord(parent: Record, raw: RecordSerialized): Record {
	const speaker = deserializeSpeaker(null, raw["speaker"]);
	const record = new Record(parent, speaker, raw["language"], <RecordType>raw["type"]);
	record.date = new Date(raw["date"]);
	record.notes = raw["notes"];
	record.duration = raw["duration"];
	record.markersReady = Boolean(raw["markers_ready"]);
	if (Array.isArray(raw["markers"])) {
		raw["markers"].forEach(m => record.markers.push(new RecordMarker(m["start"], m["end"])));
	}
	return record;
}
