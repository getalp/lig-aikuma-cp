import {Component} from '@angular/core';
import {RecordService} from "../service/record.service";
import {Speaker} from "../speaker";
import {Record} from "../record";
import {Router} from "@angular/router";


@Component({
	selector: 'page-recording-info',
	templateUrl: './recording-info.page.html',
	styleUrls: ['./recording-info.page.scss'],
})
export class RecordingInfoPage {

	public speaker: Speaker;
	public language: string;
	public notes: string;

	constructor(
		private router: Router,
		private recordService: RecordService
	) { }

	async onClickRecord() {

		const record = Record.newRaw(this.speaker, this.language);
		record.notes = this.notes;
		await this.recordService.newRawRecord(record);

		console.log(`dirPath: ${record.dirPath}, basePath: ${record.basePath}, dirRealPath: ${record.dirRealPath}, baseRealPath: ${record.baseRealPath}`);

		await this.router.navigate(["recording", "classic", record.dirName]);

	}

}
