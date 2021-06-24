import {Component, OnInit} from '@angular/core';
import {RecordService} from "../../service/record.service";
import {Speaker} from "../../speaker";
import {ActivatedRoute, Router} from "@angular/router";
import {Record, RecordType} from "../../record";
import {Toast} from "@capacitor/toast";


@Component({
	selector: 'page-recording-info',
	templateUrl: './recording-info.page.html',
	styleUrls: ['./recording-info.page.scss'],
})
export class RecordingInfoPage implements OnInit {

	public speaker: Speaker;
	public language: string;
	public notes: string;

	public recordMode: string = null;
	public recordType: RecordType = null;

	public readonly recordModes: { [key: string]: [RecordType, string] } = {
		"classic": [RecordType.Raw, "Recording"],
		"respeaking": [RecordType.Respeaking, "Respeaking"]
	};

	constructor(
		private router: Router,
		private recordService: RecordService,
		private route: ActivatedRoute
	) { }

	async ngOnInit() {

		const recordMode = this.route.snapshot.paramMap.get("recordMode");
		const recordType = this.recordModes[recordMode];

		if (recordType == null) {
			await Toast.show({text: "Unknown record type."});
		} else {
			this.recordMode = recordMode;
			this.recordType = recordType[0];
		}

    }

	async onClickRecord() {

		if (this.recordType == null) {
			return;
		}

		const parentRecordDir = this.route.snapshot.paramMap.get("parentRecordDir");
		const parent = (parentRecordDir == null) ? null : (await this.recordService.getRecord(parentRecordDir));

		const record = new Record(parent, this.speaker, this.language, this.recordType);
		record.notes = this.notes;

		await this.recordService.initRecord(record);

		await this.router.navigate(["recording", this.recordMode, record.dirName]);

	}

}
