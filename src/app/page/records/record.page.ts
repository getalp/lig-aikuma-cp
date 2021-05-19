import {Component, OnInit} from '@angular/core';
import {RecordService} from "../../service/record.service";
import {Iso639Service} from "../../service/iso-639.service";
import {ActivatedRoute} from "@angular/router";
import {Record, RecordType} from "../../record";


@Component({
	selector: 'page-record',
	templateUrl: './record.page.html',
	styleUrls: ['./record.page.scss'],
})
export class RecordPage implements OnInit {

	RecordType = RecordType

	record: Record;

	constructor(
		private route: ActivatedRoute,
		private recordService: RecordService,
		private iso639Service: Iso639Service
	) { }

	async ngOnInit() {

		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);

	}

}
