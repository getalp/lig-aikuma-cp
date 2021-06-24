import {AfterViewInit, Component, ViewChild} from '@angular/core';
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
		await this.waveformEditorRef.load(this.record.getAudioUri() /*this.record.getAacUri()*/);
		this.waveformEditorRef.addMarkersUnsafe(this.record.markers.map(recordMarker => {
			return {start: recordMarker.start, end: recordMarker.end};
		}));

	}

	async onWaveformMarkerSelected(event: [number, WaveformMarker]) {
		if (event == null) {
			await Toast.show({text: "Unselected marker"});
		} else {
			await Toast.show({text: "Selected " + event[0] + " (" + event[1].start.toFixed(1) + " - " + event[1].end.toFixed(1) + ")"});
		}
	}

}
