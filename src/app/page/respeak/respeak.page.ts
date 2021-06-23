import {AfterViewInit, Component, ViewChild} from '@angular/core';
import {Record} from "../../record";
import {ActivatedRoute} from "@angular/router";
import {RecordService} from "../../service/record.service";
import {WaveformEditorComponent} from "../../widget/waveform/editor.component";


@Component({
	selector: 'page-respeaking',
	templateUrl: './respeak.page.html',
	styleUrls: ['./respeak.page.scss'],
})
export class RespeakingPage implements AfterViewInit {

	@ViewChild("waveform")
	private waveformEditorRef: WaveformEditorComponent;

	public record: Record;

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService
	) { }

	async ngAfterViewInit() {

		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);

		// Loading the waveform from the code and not from attribute to allow awaiting.
		await this.waveformEditorRef.load(this.record.getAacUri());
		this.waveformEditorRef.addMarkersUnsafe(this.record.markers.map(recordMarker => {
			return {start: recordMarker.start, end: recordMarker.end};
		}));

	}

}
