import {Component, Input} from '@angular/core';
import {SpeakerService} from "../service/speaker.service";
import {Record} from "../record";
import {Iso639Service} from "../service/iso-639.service";
import {formatDuration} from "../utils";


@Component({
	selector: 'app-record-card',
	template: `
		<ion-card *ngIf="internalRecord != null">
			<ion-card-header>
				<ion-card-title>{{ internalRecord.speaker.name }}</ion-card-title>
				<ion-card-subtitle>{{ speakerDetails }}</ion-card-subtitle>
			</ion-card-header>
			<ion-card-content *ngIf="!internalRecord.hasAudio">Recording in {{ recordLanguage }}</ion-card-content>
			<ion-card-content *ngIf="internalRecord.hasAudio">
				<p>Recorded in: {{ recordLanguage }}</p>
				<p>Date: {{ internalRecord.date.toLocaleString() }}</p>
				<p>Duration: {{ formatDuration(internalRecord.duration) }}</p>
			</ion-card-content>
		</ion-card>
	`
})
export class RecordCardComponent {

	formatDuration = formatDuration;

	internalRecord: Record = null;
	speakerDetails: string = null;
	recordLanguage: string = null;

	constructor(
		private speakerService: SpeakerService,
		private iso639Service: Iso639Service
	) { }

	@Input()
	set record(record: Record) {
		this.internalSetRecord(record).then();
	}

	private async internalSetRecord(record: Record) {

		this.internalRecord = record;

		if (record == null) {
			this.speakerDetails = null;
			this.recordLanguage = null;
			return;
		}

		this.speakerDetails = (await this.iso639Service.getLanguage(record.speaker.nativeLanguage))?.printName;

		for (let otherLanguage of record.speaker.otherLanguages) {
			let otherLanguageObj = await this.iso639Service.getLanguage(otherLanguage);
			if (otherLanguageObj != null) {
				if (this.speakerDetails == null) {
					this.speakerDetails = "";
				} else {
					this.speakerDetails += ", ";
				}
				this.speakerDetails += otherLanguageObj.printName;
			}
		}

		this.recordLanguage = (await this.iso639Service.getLanguage(record.language))?.printName;

	}

}
