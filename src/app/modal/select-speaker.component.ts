import {Component} from '@angular/core';
import {ModalController} from "@ionic/angular";

@Component({
	selector: 'modal-select-speaker',
	templateUrl: './select-speaker.component.html',
	styleUrls: [],
})
export class SelectSpeakerModal {

	constructor(
		private modalCtl: ModalController
	) { }

}
