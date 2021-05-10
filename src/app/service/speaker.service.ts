import {Injectable} from '@angular/core';

import {Filesystem, Encoding} from "@capacitor/filesystem";

import {SpeakerSerialized, Speaker, deserializeSpeaker, serializeSpeaker} from "../speaker";
import {getCommonOptions} from "../files";



@Injectable({
	providedIn: 'root'
})
export class SpeakerService {

	private static readonly SPEAKERS_DB = "speakers.json";

	private speakers?: Promise<{ [key: string]: Speaker }>;

	constructor() { }

	load(): Promise<{ [key: string]: Speaker }> {

		if (this.speakers == null) {

			this.speakers = Filesystem.readFile({
				...getCommonOptions([SpeakerService.SPEAKERS_DB]),
				encoding: Encoding.UTF8
			}).then(res => {
				const data: { [key: string]: SpeakerSerialized } = JSON.parse(res.data);
				const speakers: { [key: string]: Speaker } = {};
				for (let [speakerUid, speakerSerialized] of Object.entries(data)) {
					speakers[speakerUid] = deserializeSpeaker(speakerUid, speakerSerialized);
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
				data[speakerUid] = serializeSpeaker(speaker);
			}

			return Filesystem.writeFile({
				...getCommonOptions([SpeakerService.SPEAKERS_DB]),
				encoding: Encoding.UTF8,
				data: JSON.stringify(data),
				recursive: true
			}).then(_ => {});

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
