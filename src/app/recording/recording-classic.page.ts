import {Component} from '@angular/core';
import {RecordService} from "../service/record.service";


@Component({
	selector: 'page-recording-classic',
	templateUrl: './recording-classic.page.html',
	styleUrls: ['./recording-classic.page.scss'],
})
export class RecordingClassicPage {

	constructor(
		private recordService: RecordService
	) { }

	resume() {
		this.recordService.resume();
	}

	pause() {
		this.recordService.pause();
	}

}
