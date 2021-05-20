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
		return this.type == RecordType.Raw && this.parent == null;
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

}


export enum RecordType {
	Raw = "raw",
	Respeaking = "respeaking",
}


export interface RecordSerialized {
	"speaker": SpeakerSerialized,
	"language": string,
	"type": string,
	"date": string,
	"notes": string,
	"duration": number | null
}


export function serializeRecord(record: Record): RecordSerialized {
	return {
		"speaker": serializeSpeaker(record.speaker),
		"language": record.language,
		"type": record.type,
		"date": record.date.toISOString(),
		"notes": record.notes,
		"duration": record.duration
	};
}


export function deserializeRecord(parent: Record, raw: RecordSerialized): Record {
	const speaker = deserializeSpeaker(null, raw["speaker"]);
	const record = new Record(parent, speaker, raw["language"], <RecordType>raw["type"]);
	record.date = new Date(raw["date"]);
	record.notes = raw["notes"];
	record.duration = raw["duration"];
	return record;
}
