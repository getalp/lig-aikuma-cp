import {Component, OnInit, ViewChild} from '@angular/core';
import {Record} from "../../record";
import {ActivatedRoute} from "@angular/router";
import {RecordService} from "../../service/record.service";
import {WaveformEditorComponent} from "../../widget/waveform/editor.component";


@Component({
	selector: 'page-mark',
	templateUrl: './mark.page.html',
	styleUrls: ['./mark.page.scss'],
})
export class MarkPage implements OnInit {

	@ViewChild("waveform")
	private waveformEditorRef: WaveformEditorComponent;
	private taskHandle: number | null = null;

	public record: Record;

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService
	) { }

	async ngOnInit() {
		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);
	}

	backwardStart() {
		this.actionStop();
		this.waveformEditorRef.moveStartTime(-0.1);
		this.taskHandle = window.setInterval(() => {
			this.waveformEditorRef.moveStartTime(-0.1);
		}, 50);
	}

	forwardStart() {
		this.actionStop();
		this.waveformEditorRef.moveStartTime(0.1);
		this.taskHandle = window.setInterval(() => {
			this.waveformEditorRef.moveStartTime(0.1);
		}, 50);
	}

	actionStop() {
		if (this.taskHandle != null) {
			window.clearInterval(this.taskHandle);
			this.taskHandle = null;
		}
	}

}
