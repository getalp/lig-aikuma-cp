import {Component, OnInit} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {Speaker, SpeakerService} from "../service/speaker.service";


@Component({
	selector: 'modal-create-speaker',
	templateUrl: './create-speaker.component.html',
	styleUrls: [],
})
export class CreateSpeakerModal implements OnInit {

	public speakers: Speaker[] = [];
	private filter: string = "";

	constructor(
		private speakerService: SpeakerService,
		private modalCtl: ModalController
	) { }

	ngOnInit(): void {

    }

}
