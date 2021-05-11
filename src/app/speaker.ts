import {Iso639Service, Language} from "./service/iso-639.service";

export enum Gender {
	Male = "male",
	Female = "female",
	Unknown = "unknown"
}

export class Speaker {

	// If UID is null, the speaker is not suitable for speakers database.
	// This can be used for storing speaker in record.

	public nativeLanguage: string;
	public otherLanguages: string[];
	public regionOfOrigin: string;
	public notes: string;
	public yearOfBirth: number;
	public gender: Gender = Gender.Unknown;

	constructor(public uid: string, public name: string) { }

	public apply(other: Speaker) {
		this.name = other.name;
		this.nativeLanguage = other.nativeLanguage;
		this.otherLanguages = other.otherLanguages;
		this.regionOfOrigin = other.regionOfOrigin;
		this.notes = other.notes;
		this.yearOfBirth = other.yearOfBirth;
		this.gender = other.gender;
	}

}

export interface SpeakerSerialized {
	"name": string;
	"native_language": string;
	"other_languages": string[];
	"region_of_origin": string;
	"notes": string;
	"year_of_birth": number;
	"gender": string
}


export function serializeSpeaker(speaker: Speaker): SpeakerSerialized {
	return {
		"name": speaker.name,
		"native_language": speaker.nativeLanguage,
		"other_languages": speaker.otherLanguages,
		"region_of_origin": speaker.regionOfOrigin,
		"notes": speaker.notes,
		"year_of_birth": speaker.yearOfBirth,
		"gender": speaker.gender
	};
}


export function deserializeSpeaker(uid: string, raw: SpeakerSerialized): Speaker {
	const speaker = new Speaker(uid, raw["name"]);
	speaker.nativeLanguage = raw["native_language"];
	speaker.otherLanguages = raw["other_languages"];
	speaker.regionOfOrigin = raw["region_of_origin"];
	speaker.notes = raw["notes"];
	speaker.yearOfBirth = raw["year_of_birth"];
	speaker.gender = <Gender>raw["gender"];
	if (speaker.gender == null) {
		speaker.gender = Gender.Unknown;
	}
	return speaker;
}
