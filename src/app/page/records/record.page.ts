import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {AlertController, ViewWillEnter} from "@ionic/angular";
import {Location} from "@angular/common";

import {RecordService} from "../../service/record.service";
import {Iso639Service} from "../../service/iso-639.service";
import {Record, RecordType} from "../../record";


@Component({
	selector: 'page-record',
	templateUrl: './record.page.html',
	styleUrls: ['./record.page.scss'],
})
export class RecordPage implements OnInit, ViewWillEnter {

	RecordType = RecordType

	record: Record;

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService,
		private iso639Service: Iso639Service,
		private location: Location,
		private alertController: AlertController,
		private changeDetector: ChangeDetectorRef
	) { }

	async ngOnInit() {
		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);
	}

	ionViewWillEnter(): void {
		this.changeDetector.detectChanges();
	}

	async onDeleteClick() {
		const alert = await this.alertController.create({
			header: "Delete this record?",
			subHeader: "Deleting a record is irreversible!",
			buttons: [
				{
					text: "Cancel",
					role: "cancel"
				},
				{
					text: "Confirm",
					handler: async () => {
						await this.actualDelete();
					}
				}
			]
		});
		alert.present().then();
	}

	private async actualDelete() {
		await this.recordService.deleteRecord(this.record);
		this.record = null;
		this.location.back();
	}

}
