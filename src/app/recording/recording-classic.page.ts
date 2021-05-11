import {Component, NgZone, OnDestroy, OnInit} from '@angular/core';
import {PluginListenerHandle} from "@capacitor/core/types/definitions";
import {ActivatedRoute} from "@angular/router";

import {RawRecorder, RecordService} from "../service/record.service";
import {AikumaNative} from "../native";


@Component({
	selector: 'page-recording-classic',
	templateUrl: './recording-classic.page.html',
	styleUrls: ['./recording-classic.page.scss'],
})
export class RecordingClassicPage implements OnInit, OnDestroy {

	private rawRecorder: RawRecorder = null;

	public time: number = 0;
	private timeHandle: Promise<PluginListenerHandle>;

	constructor(
		private ngZone: NgZone,
		private route: ActivatedRoute,
		private recordService: RecordService
	) { }

	ngOnInit() {
		this.init().then();
		this.timeHandle = AikumaNative.addListener("recordDuration", res => {
			this.ngZone.run(() => {
				this.time = res.duration;
			});
		});
	}

	ngOnDestroy() {
		this.timeHandle.then(handle => handle.remove());
	}

	private async init() {
		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		const record = await this.recordService.getRecord(recordDirName);
		this.rawRecorder = await this.recordService.beginRawRecord(record);
	}

	resume() {
		this.rawRecorder.resume();
	}

	pause() {
		this.rawRecorder.pause();
	}

	stop() {
		this.rawRecorder.stop();
	}

}
