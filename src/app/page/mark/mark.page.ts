import {AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import {Record} from "../../record";
import {ActivatedRoute} from "@angular/router";
import {RecordService} from "../../service/record.service";
import {WaveformEditorComponent} from "../../widget/waveform/editor.component";
import {Toast} from "@capacitor/toast";


@Component({
	selector: 'page-mark',
	templateUrl: './mark.page.html',
	styleUrls: ['./mark.page.scss'],
})
export class MarkPage implements AfterViewInit {

	// Re-exports
	public saveCallback = (() => this.save());

	// Elements ref
	@ViewChild("waveform")
	private waveformEditorRef: WaveformEditorComponent;

	// Public attributes
	public record: Record;

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService
	) { }

	async ngAfterViewInit() {

		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);

		// Loading the waveform from the code and not from attribute to allow awaiting.
		await this.waveformEditorRef.loadRecord(this.record, true);

	}

	async save() {
		this.record.clearMarkers();
		for (let waveformMarker of this.waveformEditorRef.markers) {
			this.record.addMarker(waveformMarker.start, waveformMarker.end);
		}
		this.record.markersReady = true;
		await this.recordService.saveRecord(this.record);
		await Toast.show({text: "Markers saved!"});
	}

}
