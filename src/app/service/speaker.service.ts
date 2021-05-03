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
					speaker.nativeLangage = speakerSerialized["native_langage"];
					speaker.auxLangages = speakerSerialized["aux_langages"];
					speaker.regionOfOrigin = speakerSerialized["region_of_origin"];
					speaker.notes = speakerSerialized["notes"];
					speaker.yearOfBirth = speakerSerialized["year_of_birth"];
					speaker.gender = Gender[speakerSerialized["gender"]];
					speakers.push(speaker);
				}
				return speakers;
			}, err => {
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
					"native_langage": speaker.nativeLangage,
					"aux_langages": speaker.auxLangages,
					"notes": speaker.notes,
					"year_of_birth": speaker.yearOfBirth,
					"gender": Gender[speaker.gender]
				})
			}

			return Filesystem.writeFile({
				path: SpeakerService.SPEAKERS_DB,
				directory: FilesystemDirectory.Documents,
				encoding: FilesystemEncoding.UTF8,
				data: JSON.stringify(data)
			}).then(_ => {});

		});
	}

}


export enum Gender {
	Male = "male",
	Female = "female",
	Unknown = "unknown"
}


export class Speaker {

	public nativeLangage: string;
	public auxLangages: string[];
	public regionOfOrigin?: string;
	public notes?: string;
	public yearOfBirth?: number;
	public gender: Gender = Gender.Unknown;

	constructor(public name: string) { }

}


interface SpeakerSerialized {
	"name": string,
	"native_langage": string;
	"aux_langages": string[];
	"region_of_origin"?: string;
	"notes"?: string;
	"year_of_birth"?: number;
	"gender": string
}
