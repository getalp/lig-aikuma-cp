import {AfterViewInit, ChangeDetectorRef, Component, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {AlertController, ViewWillEnter, ViewWillLeave} from "@ionic/angular";
import {Location} from "@angular/common";

import {RecordService} from "../../service/record.service";
import {Iso639Service} from "../../service/iso-639.service";
import {Record, RecordType} from "../../record";
import {formatDuration} from "../../utils";
import {WaveformEditorComponent} from "../../widget/waveform/editor.component";


@Component({
	selector: 'page-record',
	templateUrl: './record.page.html',
	styleUrls: ['./record.page.scss'],
})
export class RecordPage implements AfterViewInit, ViewWillEnter, ViewWillLeave {

	// Re-export
	public RecordType = RecordType;
	public formatDuration = formatDuration;

	// Element refs
	@ViewChild("waveform")
	public waveformRef: WaveformEditorComponent;

	// Public attributes
	public record: Record;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private recordService: RecordService,
		private iso639Service: Iso639Service,
		private location: Location,
		private alertController: AlertController,
		private changeDetector: ChangeDetectorRef
	) { }

	async ngAfterViewInit() {

		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);

		if (this.record != null) {
			await this.waveformRef.loadRecord(this.record, true);
		} else {
			await this.waveformRef.unload();
		}

	}

	ionViewWillEnter(): void {
		if (this.record != null) {
			this.waveformRef.clearMarkers();
			this.waveformRef.addMarkersUnsafeFromRecord(this.record);
		}
		this.changeDetector.detectChanges();
	}

	ionViewWillLeave(): void {
		this.waveformRef.stop().then();
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
