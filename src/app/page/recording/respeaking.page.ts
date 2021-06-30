import {AfterViewInit, Component, NgZone, OnDestroy, ViewChild} from '@angular/core';
import {Record, RecordType} from "../../record";
import {ActivatedRoute} from "@angular/router";
import {RecordService, RespeakingRecorder} from "../../service/record.service";
import {WaveformEditorComponent, WaveformMarker} from "../../widget/waveform/editor.component";
import {Toast} from "@capacitor/toast";
import {AlertController} from "@ionic/angular";
import {formatDuration} from "../../utils";
import {AikumaNative} from "../../native";
import {PluginListenerHandle} from "@capacitor/core/types/definitions";


@Component({
	selector: 'page-respeaking',
	templateUrl: './respeaking.page.html',
	styleUrls: ['./respeaking.page.scss'],
})
export class RespeakingPage implements AfterViewInit, OnDestroy {

	// Re-exports //
	public formatDuration = formatDuration;
	public onResetClickCallback = (() => this.onResetClick());
	public onGlobalSaveClickCallback = (() => this.onGlobalSaveClick());

	// Element refs //
	@ViewChild("waveform")
	private waveformEditorRef: WaveformEditorComponent;
	@ViewChild("previewWaveform")
	private previewWaveformEditorRef: WaveformEditorComponent;

	// Public attributes //
	public record: Record;

	public selectedMarkerIndex: number | null = null;
	public selectedMarker: WaveformMarker | null = null;
	public selectedMarkerAlreadyRecorded: boolean = false;

	public started: boolean = false;
	public paused: boolean = true;
	public duration: number = 0;

	// Private attributes //
	private respeakingRecorder: RespeakingRecorder;
	private recordDurationHandle: Promise<PluginListenerHandle>;

	constructor(
		private ngZone: NgZone,
		private route: ActivatedRoute,
		private recordService: RecordService,
		private alertController: AlertController
	) { }

	async ngAfterViewInit() {

		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);

		if (this.record.parent == null || !this.record.parent.markersReady || this.record.type !== RecordType.Respeaking) {
			console.warn("The respeaking page need a respeaking record with a parent in order to copy markers.")
			await Toast.show({text: "Failed to load."});
			this.record = null;
			return;
		}

		// this.parentRecord.copyMarkersTo(this.record);
		// this.record.markersReady = true;

		// Loading the waveform from the code and not from attribute to allow awaiting.
		await this.waveformEditorRef.loadRecord(this.record.parent, true);

		this.respeakingRecorder = await this.recordService.beginRespeakingRecord(this.record);

		this.recordDurationHandle = AikumaNative.addListener("recordDuration", res => {
			this.ngZone.run(() => {
				this.duration = res.duration;
			});
		});

	}

	async ngOnDestroy() {

		await (await this.recordDurationHandle).remove();

		if (this.record != null) {
			if (!this.record.hasAudio) {
				console.log("Not recorded, deleting record.");
				await this.recordService.deleteRecord(this.record);
			}
			this.record = null;
		}

	}

	async onWaveformMarkerSelected(marker: [number, WaveformMarker]) {

		if (this.selectedMarkerIndex != null && this.respeakingRecorder.isStarted() === this.selectedMarkerIndex) {

			const alert = await this.alertController.create({
				header: "Record is not saved!",
				subHeader: "Save the current record before leaving.",
				buttons: [
					{
						text: "Move without save",
						role: "cancel",
						handler: async () => {
							await this.doStop(true);
							await this.onWaveformMarkerSelected(marker);
						}
					},
					{
						text: "Save",
						handler: async () => {
							await this.doStop(false);
							await this.onWaveformMarkerSelected(marker);
						}
					}
				]
			});

			alert.present().then();
			return;

		}

		if (marker == null) {
			this.selectedMarkerIndex = null;
			this.selectedMarker = null;
		} else {
			this.selectedMarkerIndex = marker[0];
			this.selectedMarker = marker[1];
		}

		await this.updateSelectedMarkerInfo();

		this.started = false;
		this.paused = true;

	}

	async onPauseOrResumeClick() {
		if (this.selectedMarkerIndex != null) {
			await this.respeakingRecorder.toggleRecording(this.selectedMarkerIndex);
			this.started = this.respeakingRecorder.isStarted() != null;
			this.paused = this.respeakingRecorder.isPaused();
		}
	}

	async onSaveClick() {
		if (this.selectedMarkerIndex != null && this.respeakingRecorder.isStarted() === this.selectedMarkerIndex) {
			await this.doStop(false);
		}
	}

	async onResetClick() {
		if (this.selectedMarkerIndex != null) {

			const alert = await this.alertController.create({
				header: "Reset this record?",
				subHeader: "Reset this record to retry.",
				buttons: [
					{
						text: "Cancel",
						role: "cancel"
					},
					{
						text: "Reset",
						handler: async () => {
							await this.respeakingRecorder.resetRecording(this.selectedMarkerIndex);
							await this.updateSelectedMarkerInfo();
						}
					}
				]
			});

			alert.present().then();

		}
	}

	async onGlobalSaveClick() {

		if (this.started) {
			const alert = await this.alertController.create({
				header: "Please finish your respeaking before saving.",
				buttons: [
					{
						text: "Ok",
						role: "cancel"
					}
				]
			});
			alert.present().then();
		} else {
			const respeakingCount = this.respeakingRecorder.getTempRecordCount();
			if (respeakingCount > 0) {
				const alert = await this.alertController.create({
					header: "Save the respeaking?",
					buttons: [
						{
							text: "Cancel",
							role: "cancel"
						},
						{
							text: "Save",
							handler: async () => {
								await this.doGlobalSave();
							}
						}
					]
				});
				alert.present().then();
			} else {
				const alert = await this.alertController.create({
					header: "You must respeak at least one segment.",
					buttons: [
						{
							text: "Ok",
							role: "cancel"
						}
					]
				});
				alert.present().then();
			}
		}

	}

	// Private //

	private async doStop(abort: boolean) {
		await this.respeakingRecorder.stopRecording(this.selectedMarkerIndex, abort);
		await this.updateSelectedMarkerInfo();
		this.started = false;
		this.paused = true;
	}

	private async updateSelectedMarkerInfo() {
		const tempRecord = (this.selectedMarkerIndex == null) ? null : this.respeakingRecorder.getTempRecord(this.selectedMarkerIndex);
		if (tempRecord == null) {
			this.selectedMarkerAlreadyRecorded = false;
			await this.previewWaveformEditorRef.unload();
		} else {
			this.selectedMarkerAlreadyRecorded = true;
			await this.previewWaveformEditorRef.load(tempRecord.uri);
		}
	}

	private async doGlobalSave() {
		await this.respeakingRecorder.saveRespeaking();
	}

}
