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
	private task = new ProgressiveTask();

	public record: Record;

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService
	) { }

	async ngOnInit() {
		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);
	}

	private static getTaskDurationFactor(duration: number): number {
		return Math.log(1 + duration / 20) * 5;
	}

	backwardStart() {
		this.waveformEditorRef.moveStartTime(-0.01);
		this.task.start(dur => {
			this.waveformEditorRef.moveStartTime(-MarkPage.getTaskDurationFactor(dur));
		}, 50);
	}

	forwardStart() {
		this.waveformEditorRef.moveStartTime(0.01);
		this.task.start(dur => {
			this.waveformEditorRef.moveStartTime(MarkPage.getTaskDurationFactor(dur));
		}, 50);
	}

	actionStop() {
		this.task.stop();
	}

	addMarker() {
		this.waveformEditorRef.addMarkerAtStartTime();
	}

	removeMarker() {
		// this.waveformEditorRef.removeSelectedMarkers();
	}

}


class ProgressiveTask {

	private taskHandle: number | null = null;
	private taskStart: number | null = null;

	start(handler: (dur: number) => void, interval: number) {
		this.stop();
		this.taskStart = Date.now();
		this.taskHandle = window.setInterval(() => {
			handler((Date.now() - this.taskStart) / 1000);
		}, interval);
	}

	stop() {
		if (this.taskHandle != null) {
			window.clearInterval(this.taskHandle);
			this.taskHandle = null;
			this.taskStart = null;
		}
	}

}
