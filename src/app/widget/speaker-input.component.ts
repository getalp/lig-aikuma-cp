import {Component, Output, EventEmitter} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {SpeakerService} from "../service/speaker.service";
import {SelectSpeakerModal} from "../modal/select-speaker.component";
import {Speaker} from "../speaker";


@Component({
	selector: 'app-speaker-select',
	template: '<ion-button #button (click)="onClick()" [disabled]="modalOpened">{{ text }}</ion-button>'
})
export class SpeakerSelectComponent {

	private static readonly NO_SELECT_TEXT = "Select";

	@Output()
	public speakerChanged = new EventEmitter<any>();

	private speaker?: any;
	public text: string = SpeakerSelectComponent.NO_SELECT_TEXT;
	public modalOpened: boolean = false;

	constructor(
		private speakerService: SpeakerService,
		private modalCtl: ModalController
	) { }

	async onClick() {
		if (!this.modalOpened) {
			this.modalOpened = true;
			try {
				const modal = await this.modalCtl.create({
					component: SelectSpeakerModal
				});
				modal.present().then();
				const detail = await modal.onWillDismiss();
				if (detail.data != null) {
					this.setSpeaker(detail.data.speaker);
				}
			} finally {
				this.modalOpened = false;
			}
		}
	}

	private setSpeaker(speaker?: Speaker) {
		this.speaker = speaker;
		this.text = (speaker == null) ? SpeakerSelectComponent.NO_SELECT_TEXT : speaker.name;
		this.speakerChanged.emit(speaker);
	}

}
