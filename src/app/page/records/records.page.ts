import {Component, OnInit} from '@angular/core';
import {RecordService} from "../../service/record.service";
import {Record} from "../../record";
import {ViewWillEnter} from "@ionic/angular";


@Component({
	selector: 'page-records',
	templateUrl: './records.page.html',
	styleUrls: ['./records.page.scss'],
})
export class RecordsPage implements OnInit, ViewWillEnter {

	// Public attributes
	public records: Record[];

	constructor(
		private recordService: RecordService
	) { }

	ngOnInit(): void {
		this.refresh().then();
	}

	ionViewWillEnter(): void {
		this.refresh().then();
	}

	private async refresh() {
		this.records = Object.values(await this.recordService.ensureLoaded());
	}

}
