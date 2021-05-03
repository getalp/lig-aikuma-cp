import {Component, OnInit} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {Speaker, SpeakerService} from "../service/speaker.service";
import {Language} from "../service/iso-639.service";


@Component({
	selector: 'modal-create-speaker',
	templateUrl: './create-speaker.component.html',
	styleUrls: [],
})
export class CreateSpeakerModal implements OnInit {

	public readonly otherLanguageOrdinals = {
		0: "Secondary",
		1: "Tertiary",
		"default": idx => (idx + 2) + "th"
	};

	public otherLanguagesIdx: void[] = [];
	public otherLanguages: string[] = [];

	constructor(
		private speakerService: SpeakerService,
		private modalCtl: ModalController
	) { }

	ngOnInit(): void {

    }

    addOtherLanguage() {
		this.otherLanguagesIdx.push(null);
		this.otherLanguages.push(null);
	}

	setNativeLanguage(lang: Language) {
		this.addOtherLanguage();
	}

	setOtherLanguage(idx: number, lang?: Language) {
		const lastLang = this.otherLanguages[idx];
		if (lastLang != null && lang == null) {
			this.otherLanguages.splice(idx, 1);
			this.otherLanguagesIdx.pop();
		} else {
			this.otherLanguages[idx] = lang.code;
			if (lastLang == null) {
				this.addOtherLanguage();
			}
		}
	}

}
