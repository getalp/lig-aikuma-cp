import {Component, OnInit} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {SpeakerService, Speaker} from "../service/speaker.service";
import {Iso639Service} from "../service/iso-639.service";
import {CreateSpeakerModal} from "./create-speaker.component";


@Component({
	selector: 'modal-select-speaker',
	templateUrl: './select-speaker.component.html',
	styleUrls: [],
})
export class SelectSpeakerModal implements OnInit {

	public speakers: [Speaker, Promise<string>][] = [];
	private filter: string = "";

	constructor(
		private speakerService: SpeakerService,
		private iso639Service: Iso639Service,
		private modalCtl: ModalController
	) { }

	ngOnInit(): void {
        this.load();
    }

	doSearch(e) {
		this.filter = e.target.value.toLowerCase();
		this.load();
	}

	onClickSpeaker(speaker: Speaker) {
		this.modalCtl.dismiss({
			speaker: speaker
		}).then();
	}

	onClickEditSpeaker(speaker: Speaker) {
		this.modalCtl.create({
			component: CreateSpeakerModal,
			componentProps: {
				"editSpeaker": speaker
			}
		}).then(r => {
			return r.present().then(() => {
				r.onWillDismiss().then(value => {
					if (value.data != null) {
						speaker.apply(value.data.speaker);
						this.speakerService.save().then(() => {
							this.load();
						});
					}
				});
			});
		});
	}

	onClickNew() {
		this.modalCtl.create({
			component: CreateSpeakerModal
		}).then(r => {
			return r.present().then(() => {
				r.onWillDismiss().then(value => {
					if (value.data != null) {
						const speaker: Speaker = value.data.speaker;
						if (this.filterSpeaker(speaker)) {
							this.addSpeaker(speaker);
						}
					}
				});
			});
		});
	}

	// Internal //

	private load() {
		this.speakerService.load().then(speakers => {
			this.speakers = [];
			for (let speaker of speakers) {
				if (this.filterSpeaker(speaker)) {
					this.addSpeaker(speaker);
				}
			}
		});
	}

	private filterSpeaker(speaker: Speaker): boolean {
		return speaker.name.toLowerCase().includes(this.filter);
	}

	private addSpeaker(speaker: Speaker) {
		this.speakers.push([
			speaker,
			this.iso639Service.getLanguage(speaker.nativeLanguage)
				.then(lang => {
					return lang == null ? "Unknown native language" : lang.printName;
				})
		])
	}

}
