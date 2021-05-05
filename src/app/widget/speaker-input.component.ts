import {Component, Output, EventEmitter} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {SpeakerService} from "../service/speaker.service";
import {SelectSpeakerModal} from "../modal/select-speaker.component";
import {Speaker} from "../speaker";


@Component({
	selector: 'app-speaker-select',
	template: '<ion-button #button (click)="onClick()">{{ text }}</ion-button>'
})
export class SpeakerSelectComponent {

	private static readonly NO_SELECT_TEXT = "Select";

	@Output()
	public speakerChanged = new EventEmitter<any>();

	private speaker?: any;
	public text: string = SpeakerSelectComponent.NO_SELECT_TEXT;

	constructor(
		private speakerService: SpeakerService,
		private modalCtl: ModalController
	) { }

	onClick() {
		this.modalCtl.create({
			component: SelectSpeakerModal
		}).then(r => {
			return r.present().then(() => {
				r.onWillDismiss().then(value => {
					if (value.data != null) {
						this.setSpeaker(value.data.speaker);
					}
				});
			});
		});
	}

	private setSpeaker(speaker?: Speaker) {
		this.speaker = speaker;
		this.text = (speaker == null) ? SpeakerSelectComponent.NO_SELECT_TEXT : speaker.name;
		this.speakerChanged.emit(speaker);
	}

}
