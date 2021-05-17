import {Component, OnInit} from '@angular/core';
import {RecordService} from "../../service/record.service";
import {Record} from "../../record";
import {Iso639Service, Language} from "../../service/iso-639.service";
import {formatDuration} from "../../utils";


@Component({
	selector: 'page-records',
	templateUrl: './records.page.html',
	styleUrls: ['./records.page.scss'],
})
export class RecordsPage implements OnInit {

	records: [Record, Promise<Language>][];

	constructor(
		private recordService: RecordService,
		private iso639Service: Iso639Service
	) { }

	ngOnInit() {
		this.refresh().then();
	}

	formatDuration(dur: number): string {
		return formatDuration(dur);
	}

	private async refresh() {
		this.records = Object.values(await this.recordService.ensureLoaded())
			.sort((a, b) => b.date.getTime() - a.date.getTime())
			.map(record => [record, this.iso639Service.getLanguage(record.language)]);
	}

}
