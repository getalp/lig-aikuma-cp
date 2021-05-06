import {Component, Input} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {SpeakerService} from "../service/speaker.service";
import {Plugins} from "@capacitor/core";
import {Gender, Speaker} from "../speaker";
const {Toast} = Plugins;


@Component({
	selector: 'modal-create-speaker',
	templateUrl: './create-speaker.component.html',
	styleUrls: [],
})
export class CreateSpeakerModal {

	public readonly otherLanguageOrdinals = {
		0: "Secondary",
		1: "Tertiary",
		"default": idx => (idx + 2) + "th"
	};

	public name: string = "";
	public yearOfBirth: string = "";
	public gender: Gender = Gender.Unknown;
	public regionOfOrigin: string = "";
	public notes: string = "";
	public nativeLanguage: string = null;
	public otherLanguagesIdx: void[] = [null];
	public otherLanguages: string[] = [null];

	public editingSpeakerUid: string = null;

	constructor(
		private speakerService: SpeakerService,
		private modalCtl: ModalController
	) { }

	@Input()
	set editSpeakerUid(speakerUid: string) {
		this.speakerService.get(speakerUid).then(speaker => {
			this.editingSpeakerUid = speakerUid;
			this.name = speaker.name;
			this.yearOfBirth = (speaker.yearOfBirth == null) ? "" : speaker.yearOfBirth.toString();
			this.gender = speaker.gender;
			this.regionOfOrigin = speaker.regionOfOrigin;
			this.notes = speaker.notes;
			this.nativeLanguage = speaker.nativeLanguage;
			this.otherLanguages = speaker.otherLanguages.slice();
			this.otherLanguagesIdx = new Array(this.otherLanguages.length);
			this.addOtherLanguage();
		}).catch(_err => {
			this.editingSpeakerUid = null;
			this.resetLanguage();
		});
	}

	private resetLanguage() {
		this.otherLanguages = [null];
		this.otherLanguagesIdx = [null];
	}

    addOtherLanguage() {
		this.otherLanguagesIdx.push(null);
		this.otherLanguages.push(null);
	}

	setNativeLanguage(langCode: string) {
		this.nativeLanguage = langCode;
	}

	setOtherLanguage(idx: number, langCode: string) {
		const lastLang = this.otherLanguages[idx];
		if (lastLang != null && langCode == null) {
			if (this.otherLanguages.length > 1) {
				this.otherLanguages.splice(idx, 1);
				this.otherLanguagesIdx.pop();
			}
		} else {
			this.otherLanguages[idx] = langCode;
			if (lastLang == null) {
				this.addOtherLanguage();
			}
		}
	}

	onClickSave() {

		if (this.name.length === 0) {
			// Should not happen if the button is properly disabled
			return;
		}

		const yearOfBirth = (this.yearOfBirth.length === 0) ? null : parseInt(this.yearOfBirth);
		if (yearOfBirth !== null && isNaN(yearOfBirth)) {
			Toast.show({
				text: "Invalid year of birth!"
			}).then();
			return;
		}

		let speakerPromise: Promise<Speaker>;
		const editing = (this.editingSpeakerUid != null);

		if (editing) {
			speakerPromise = this.speakerService.get(this.editingSpeakerUid).then(speaker => {
				speaker.name = this.name;
				return speaker;
			});
		} else {
			speakerPromise = this.speakerService.alloc(this.name);
		}

		speakerPromise.then(speaker => {

			speaker.yearOfBirth = yearOfBirth;
			speaker.gender = this.gender;
			speaker.regionOfOrigin = this.regionOfOrigin;
			speaker.notes = this.notes;
			speaker.nativeLanguage = this.nativeLanguage;
			speaker.otherLanguages = [];

			for (let otherLang of this.otherLanguages) {
				if (otherLang != null) {
					speaker.otherLanguages.push(otherLang);
				}
			}

			this.speakerService.save().then(() => {

				Toast.show({
					text: "Successfully " + (editing ? "edited" : "created") + " speaker " + speaker.name
				}).then();

				this.modalCtl.dismiss({
					speaker: speaker,
					edited: editing
				}).then();

			});

		}).catch(err => {
			Toast.show({text: "Failed to edit or create speaker: " + err}).then();
		});

	}

	getGenders(): [Gender, string][] {
		return [
			[Gender.Unknown, "Unknown"],
			[Gender.Male, "Male"],
			[Gender.Female, "Female"],
		]
	}

}
