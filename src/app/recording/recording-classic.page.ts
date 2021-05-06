import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from "@angular/router";

import {RecordService} from "../service/record.service";
import {Record} from "../record";


@Component({
	selector: 'page-recording-classic',
	templateUrl: './recording-classic.page.html',
	styleUrls: ['./recording-classic.page.scss'],
})
export class RecordingClassicPage implements OnInit {

	private record: Record = null;

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService
	) {
		console.log("RecordingClassicPage construct")
	}

	ngOnInit() {

		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.recordService.getRecord(recordDirName).then(record => {
			this.record = record;
			console.log("record: " + JSON.stringify(record));
		});

	}

	resume() {
		this.recordService.resume();
	}

	pause() {
		this.recordService.pause();
	}

}
