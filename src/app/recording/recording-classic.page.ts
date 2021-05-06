import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from "@angular/router";

import {RawRecorder, RecordService} from "../service/record.service";
import {Record} from "../record";


@Component({
	selector: 'page-recording-classic',
	templateUrl: './recording-classic.page.html',
	styleUrls: ['./recording-classic.page.scss'],
})
export class RecordingClassicPage implements OnInit {

	private record: Record = null;
	private rawRecorder: RawRecorder = null;

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService
	) {
		console.log("RecordingClassicPage construct")
	}

	ngOnInit() {
		this.init().then();
	}

	private async init() {
		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		const record = await this.recordService.getRecord(recordDirName);
		this.rawRecorder = await this.recordService.beginRawRecord(record);
	}

	start() {
		this.rawRecorder.start();
	}

	stop() {
		this.rawRecorder.stop();
	}

}
