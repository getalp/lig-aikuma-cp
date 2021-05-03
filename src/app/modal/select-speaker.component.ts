import {Component, OnInit} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {Speaker, SpeakerService} from "../service/speaker.service";
import {Iso639Service} from "../service/iso-639.service";
import {CreateSpeakerModal} from "./create-speaker.component";


@Component({
	selector: 'modal-select-speaker',
	templateUrl: './select-speaker.component.html',
	styleUrls: [],
})
export class SelectSpeakerModal implements OnInit {

	public speakers: Speaker[] = [];
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

	speakerClicked(speaker: Speaker) {
		this.modalCtl.dismiss({
			speaker: speaker
		}).then();
	}

	getSpeakerExtra(speaker: Speaker): Promise<string> {
		return this.iso639Service.getLanguage(speaker.nativeLanguage)
			.then(lang => {
				return lang.printName;
			});
	}

	private load() {
		this.speakerService.load().then(speakers => {
			this.speakers = speakers;
			// TODO: Apply Filter
		});
	}

	// New Speaker //

	onClickNew() {
		this.modalCtl.create({
			component: CreateSpeakerModal
		}).then(r => {
			return r.present().then(() => {
				r.onWillDismiss().then(value => {
					if (value.data != null) {
						console.log("Created speaker: ", value.data);
					}
				});
			});
		});
	}

}
