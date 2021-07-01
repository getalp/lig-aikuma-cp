import {Component, Input} from '@angular/core';
import {Iso639Service, Language} from "../service/iso-639.service";
import {getRecordTypeIcon, Record} from "../record";
import {RecordService} from "../service/record.service";
import {formatDuration, getNullablePropertyOrDefault} from "../utils";


@Component({
	selector: 'app-records-list',
	template: `
		<ion-list *ngIf="internalRecords != null">
			<ion-list-header *ngIf="titleText != null">
				<h5>{{ titleText }}</h5>
			</ion-list-header>
			<ion-item button *ngFor="let record of internalRecords"
					  [color]="record.record.markersReady ? null : 'warning'"
					  [routerLink]="'/record/' + record.record.dirName"
					  [detail]="true" [detailIcon]="getRecordTypeIcon(record.record.type)">
				<ion-label>
					<h2>{{ record.record.date.toLocaleString() }}<span
						*ngIf="record.record.duration != null">&nbsp;&bull;&nbsp;{{ formatDuration(record.record.duration) }}</span>
					</h2>
					<h4>{{ record.record.speaker.name }}&nbsp;&bull;&nbsp;{{ getNullablePropertyOrDefault(record.language | async, "printName", "") }}<span
						*ngIf="!record.record.markersReady">&nbsp;&bull;&nbsp;markers missing</span></h4>
				</ion-label>
			</ion-item>
			<ion-item *ngIf="internalRecords.length === 0">
				<ion-label>
					<h2>{{ noRecordText }}</h2>
				</ion-label>
			</ion-item>
		</ion-list>
	`
})
export class RecordsListComponent {

	// Re-exports
	public getRecordTypeIcon = getRecordTypeIcon;
	public formatDuration = formatDuration;
	public getNullablePropertyOrDefault = getNullablePropertyOrDefault;

	// Inputs
	@Input() titleText: string = null;
	@Input() noRecordText: string = "No record";

	// Public attributes
	public internalRecords: RecordItem[] = [];

	constructor(
		private recordService: RecordService,
		private iso639Service: Iso639Service
	) { }

	@Input()
	set records(records: Record[]) {
		if (records != null) {
			this.setRecords(records);
		}
	}

	public setRecords(records: Record[]) {
		this.internalRecords = records
			.sort((a, b) => b.date.getTime() - a.date.getTime())
			.map(record => {
				return {
					record: record,
					language: this.iso639Service.getLanguage(record.language)
				};
			});
	}

}


interface RecordItem {
	record: Record,
	language: Promise<Language>
}
