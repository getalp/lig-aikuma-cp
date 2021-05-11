import {Component, NgZone, OnDestroy, OnInit} from '@angular/core';
import {PluginListenerHandle} from "@capacitor/core/types/definitions";
import {ActivatedRoute} from "@angular/router";

import {RawRecorder, RecordService} from "../service/record.service";
import {AikumaNative} from "../native";
import {Record} from "../record";
import {Iso639Service} from "../service/iso-639.service";


@Component({
	selector: 'page-recording-classic',
	templateUrl: './recording-classic.page.html',
	styleUrls: ['./recording-classic.page.scss'],
})
export class RecordingClassicPage implements OnInit, OnDestroy {

	private rawRecorder: RawRecorder = null;
	private timeHandle: Promise<PluginListenerHandle>;

	public duration: number = 0;
	public record: Record;
	public speakerDetails: string;
	public recordingDetails: string;

	public started: boolean = false;
	public paused: boolean = false;

	constructor(
		private ngZone: NgZone,
		private route: ActivatedRoute,
		private recordService: RecordService,
		private iso639Service: Iso639Service
	) { }

	async ngOnInit() {

		const recordDirName = this.route.snapshot.paramMap.get("recordDirName");
		this.record = await this.recordService.getRecord(recordDirName);
		this.rawRecorder = await this.recordService.beginRawRecord(this.record);

		this.speakerDetails = (await this.iso639Service.getLanguage(this.record.speaker.nativeLanguage))?.printName;

		for (let otherLanguage of this.record.speaker.otherLanguages) {
			let otherLanguageObj = await this.iso639Service.getLanguage(otherLanguage);
			if (otherLanguageObj != null) {
				if (this.speakerDetails == null) {
					this.speakerDetails = "";
				} else {
					this.speakerDetails += ", ";
				}
				this.speakerDetails += otherLanguageObj.printName;
			}
		}

		this.recordingDetails = (await this.iso639Service.getLanguage(this.record.language))?.printName;

		this.timeHandle = AikumaNative.addListener("recordDuration", res => {
			this.ngZone.run(() => {
				this.duration = res.duration;
			});
		});

		this.paused = true;

	}

	ngOnDestroy() {
		this.timeHandle.then(handle => handle.remove());
		this.rawRecorder.stop().catch(() => {});
	}

	// Public API //

	async onPauseOrResumeClick() {
		await this.rawRecorder.toggle();
		this.started = this.rawRecorder.isStarted();
		this.paused = this.rawRecorder.isPaused();
	}

	async onStopClick() {
		await this.rawRecorder.stop();
		this.started = this.rawRecorder.isStarted();
		this.paused = this.rawRecorder.isPaused();
		console.log(`this.started: ${this.started}, this.paused: ${this.paused}`);
	}

}
