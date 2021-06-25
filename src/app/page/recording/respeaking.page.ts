import {AfterViewInit, Component, OnDestroy, ViewChild} from '@angular/core';
import {Record, RecordType} from "../../record";
import {ActivatedRoute} from "@angular/router";
import {RecordService, RespeakingRecorder} from "../../service/record.service";
import {WaveformEditorComponent, WaveformMarker} from "../../widget/waveform/editor.component";
import {Toast} from "@capacitor/toast";


@Component({
	selector: 'page-respeaking',
	templateUrl: './respeaking.page.html',
	styleUrls: ['./respeaking.page.scss'],
})
export class RespeakingPage implements AfterViewInit, OnDestroy {

	@ViewChild("waveform")
	private waveformEditorRef: WaveformEditorComponent;

	public record: Record;
	public parentRecord: Record;

	public selectedMarkerIndex: number | null = null;
	public selectedMarker: WaveformMarker | null = null;
	public selectedMarkerNewDuration: number = 0;
	public paused: boolean = true;

	private respeakingRecorder: RespeakingRecorder;

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService
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

		this.parentRecord = this.record.parent;
		this.parentRecord.copyMarkersTo(this.record);
		this.record.markersReady = true;

		// Loading the waveform from the code and not from attribute to allow awaiting.
		await this.waveformEditorRef.loadRecord(this.parentRecord, true);

		this.respeakingRecorder = await this.recordService.beginRespeakingRecord(this.record);

	}

	async ngOnDestroy() {
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
			await this.respeakingRecorder.stopRecording(this.selectedMarkerIndex);
		}
		this.selectedMarkerIndex = (marker == null) ? null : marker[0];
		this.selectedMarker = (marker == null) ? null : marker[1];
		this.selectedMarkerNewDuration = (marker == null) ? 0 : this.respeakingRecorder.getRecordingDuration(marker[0]);
		this.paused = true;
	}

	async onPauseOrResumeClick() {
		if (this.selectedMarkerIndex != null) {
			await this.respeakingRecorder.toggleRecording(this.selectedMarkerIndex);
			this.paused = this.respeakingRecorder.isPaused();
		}
	}

}
