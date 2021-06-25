import {AfterViewInit, Component, OnDestroy, ViewChild} from '@angular/core';
import {Record} from "../../record";
import {ActivatedRoute} from "@angular/router";
import {RecordService} from "../../service/record.service";
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

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService
	) { }

	async ngAfterViewInit() {

		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);

		if (this.record.parent == null) {
			console.warn("The respeaking page need a record with a parent in order to copy markers.")
			await Toast.show({text: "Failed to load."});
			this.record = null;
			return;
		}

		this.parentRecord = this.record.parent;

		// Loading the waveform from the code and not from attribute to allow awaiting.
		await this.waveformEditorRef.loadRecord(this.parentRecord, true);

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

	async onWaveformMarkerSelected(event: [number, WaveformMarker]) {
		if (event == null) {
			await Toast.show({text: "Unselected marker"});
		} else {
			await Toast.show({text: "Selected " + event[0] + " (" + event[1].start.toFixed(1) + " - " + event[1].end.toFixed(1) + ")"});
		}
	}

}
