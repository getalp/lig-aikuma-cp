import {Injectable} from '@angular/core';

import {FilesystemDirectory, FilesystemEncoding, Plugins} from '@capacitor/core';

const {Filesystem} = Plugins;


@Injectable({
	providedIn: 'root'
})
export class SpeakerService {

	private static readonly SPEAKERS_DB = "speakers.json";

	private speakers?: Promise<Speaker[]>;

	constructor() { }

	load(): Promise<Speaker[]> {
		if (this.speakers == null) {
			this.speakers = Filesystem.readFile({
				path: SpeakerService.SPEAKERS_DB,
				directory: FilesystemDirectory.Documents,
				encoding: FilesystemEncoding.UTF8
			}).then(res => {
				const data: SpeakerSerialized[] = JSON.parse(res.data);
				const speakers: Speaker[] = [];
				for (let speakerSerialized of data) {
					const speaker = new Speaker(speakerSerialized["name"]);
					speaker.nativeLanguage = speakerSerialized["native_language"];
					speaker.otherLanguages = speakerSerialized["other_languages"];
					speaker.regionOfOrigin = speakerSerialized["region_of_origin"];
					speaker.notes = speakerSerialized["notes"];
					speaker.yearOfBirth = speakerSerialized["year_of_birth"];
					speaker.gender = <Gender>speakerSerialized["gender"];
					if (speaker.gender == null) {
						speaker.gender = Gender.Unknown;
					}
					speakers.push(speaker);
				}
				return speakers;
			}, _err => {
				return [];
			});
		}
		return this.speakers;
	}

	save(): Promise<void> {
		const speakersPromise = (this.speakers == null) ? Promise.resolve([]) : this.speakers;
		return speakersPromise.then(speakers => {
			const data: SpeakerSerialized[] = [];
			for (let speaker of speakers) {
				data.push({
					"name": speaker.name,
					"native_language": speaker.nativeLanguage,
					"other_languages": speaker.otherLanguages,
					"region_of_origin": speaker.regionOfOrigin,
					"notes": speaker.notes,
					"year_of_birth": speaker.yearOfBirth,
					"gender": speaker.gender
				});
			}
			return Filesystem.writeFile({
				path: SpeakerService.SPEAKERS_DB,
				directory: FilesystemDirectory.Documents,
				encoding: FilesystemEncoding.UTF8,
				data: JSON.stringify(data)
			}).then(_ => {});
		});
	}

	add(speaker: Speaker): Promise<void> {
		return this.load()
			.then(speakers => speakers.push(speaker))
			.then(_ => this.save());
	}

}


export enum Gender {
	Male = "male",
	Female = "female",
	Unknown = "unknown"
}


export class Speaker {

	public nativeLanguage: string;
	public otherLanguages: string[];
	public regionOfOrigin: string;
	public notes: string;
	public yearOfBirth: number;
	public gender: Gender = Gender.Unknown;

	constructor(public name: string) { }

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


interface SpeakerSerialized {
	"name": string;
	"native_language": string;
	"other_languages": string[];
	"region_of_origin": string;
	"notes": string;
	"year_of_birth": number;
	"gender": string
}
