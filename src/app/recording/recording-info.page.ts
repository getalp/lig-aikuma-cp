import {Component} from '@angular/core';
import {RecordService} from "../service/record.service";
import {Speaker} from "../speaker";
import {Language} from "../service/iso-639.service";
import {Record} from "../record";
import {Router} from "@angular/router";


@Component({
	selector: 'page-recording-info',
	templateUrl: './recording-info.page.html',
	styleUrls: ['./recording-info.page.scss'],
})
export class RecordingInfoPage {

	public speaker: Speaker;
	public language: Language;
	public notes: string;

	constructor(
		private router: Router,
		private recordService: RecordService
	) { }

	onClickRecord() {

		const record = new Record(this.speaker, this.language);
		record.notes = this.notes;
		this.recordService.setup(record);

		this.router.navigate(["recording", "classic"]).then();

	}

}
