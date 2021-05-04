import {Component, Input} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {Gender, Speaker, SpeakerService} from "../service/speaker.service";
import {Plugins} from "@capacitor/core";
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

	public editing: boolean = false;

	constructor(
		private speakerService: SpeakerService,
		private modalCtl: ModalController
	) { }

	@Input()
	set editSpeaker(speaker: Speaker) {
		if (speaker != null) {
			this.editing = true;
			this.name = speaker.name;
			this.yearOfBirth = (speaker.yearOfBirth == null) ? "" : speaker.yearOfBirth.toString();
			this.gender = speaker.gender;
			this.regionOfOrigin = speaker.regionOfOrigin;
			this.notes = speaker.notes;
			this.nativeLanguage = speaker.nativeLanguage;
			this.otherLanguages = speaker.otherLanguages.slice();
			this.otherLanguagesIdx = new Array(this.otherLanguages.length);
			this.addOtherLanguage();
		} else {
			this.editing = false;
			this.resetLanguage();
		}
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
		//const wasNull = (this.nativeLanguage == null);
		this.nativeLanguage = langCode;
		/*if (wasNull && langCode != null && this.otherLanguagesIdx.length === 0) {
			this.addOtherLanguage();
		}*/
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

		const speaker = new Speaker(this.name);
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

		if (this.editing) {
			this.speakerService.save().then(() => {
				Toast.show({
					text: "Successfully edited speaker " + speaker.name
				}).then();
				this.modalCtl.dismiss({
					speaker: speaker,
					edited: true
				}).then();
			});
		} else {
			this.speakerService.add(speaker).then(() => {
				Toast.show({
					text: "Successfully created speaker " + speaker.name
				}).then();
				this.modalCtl.dismiss({
					speaker: speaker
				}).then();
			});
		}

	}

	getGenders(): [Gender, string][] {
		return [
			[Gender.Unknown, "Unknown"],
			[Gender.Male, "Male"],
			[Gender.Female, "Female"],
		]
	}

}
