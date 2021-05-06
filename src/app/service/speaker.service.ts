import {Injectable} from '@angular/core';

import {FilesystemEncoding, Plugins} from '@capacitor/core';
const {Filesystem} = Plugins;

import {getReadOptions, getWriteOptions} from "../files";
import {Gender, Speaker} from "../speaker";


@Injectable({
	providedIn: 'root'
})
export class SpeakerService {

	private static readonly SPEAKERS_DB = "speakers.json";

	private speakers?: Promise<{ [key: string]: Speaker }>;

	constructor() { }

	load(): Promise<{ [key: string]: Speaker }> {

		if (this.speakers == null) {

			const options = getReadOptions([SpeakerService.SPEAKERS_DB], FilesystemEncoding.UTF8);

			this.speakers = Filesystem.readFile(options).then(res => {
				const data: { [key: string]: SpeakerSerialized } = JSON.parse(res.data);
				const speakers: { [key: string]: Speaker } = {};
				for (let [speakerUid, speakerSerialized] of Object.entries(data)) {
					const speaker = new Speaker(speakerUid, speakerSerialized["name"]);
					speaker.nativeLanguage = speakerSerialized["native_language"];
					speaker.otherLanguages = speakerSerialized["other_languages"];
					speaker.regionOfOrigin = speakerSerialized["region_of_origin"];
					speaker.notes = speakerSerialized["notes"];
					speaker.yearOfBirth = speakerSerialized["year_of_birth"];
					speaker.gender = <Gender>speakerSerialized["gender"];
					if (speaker.gender == null) {
						speaker.gender = Gender.Unknown;
					}
					speakers[speakerUid] = speaker;
				}
				return speakers;
			}, _err => {
				return {};
			});

		}

		return this.speakers;

	}

	save(): Promise<void> {

		const speakersPromise = (this.speakers == null) ? Promise.resolve({}) : this.speakers;

		return speakersPromise.then(speakers => {

			const data: { [key: string]: SpeakerSerialized } = {};

			for (let [speakerUid, speaker] of Object.entries(speakers)) {
				data[speakerUid] = {
					"name": speaker.name,
					"native_language": speaker.nativeLanguage,
					"other_languages": speaker.otherLanguages,
					"region_of_origin": speaker.regionOfOrigin,
					"notes": speaker.notes,
					"year_of_birth": speaker.yearOfBirth,
					"gender": speaker.gender
				};
			}

			const options = getWriteOptions(
				[SpeakerService.SPEAKERS_DB],
				FilesystemEncoding.UTF8,
				JSON.stringify(data)
			);

			return Filesystem.writeFile(options).then(_ => {});

		});

	}

	alloc(name: string): Promise<Speaker> {
		return this.load()
			.then(speakers => {
				let uid;
				do {
					uid = Math.floor(Math.random() * 10000000).toString();
				} while (uid in speakers);
				const speaker = new Speaker(uid, name);
				speakers[uid] = speaker;
				return speaker;
			});
	}

	get(uid: string): Promise<Speaker> {
		return this.load().then(speakers => {
			const speaker = speakers[uid];
			return speaker == null ? Promise.reject("Unknown speaker.") : Promise.resolve(speaker);
		});
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
