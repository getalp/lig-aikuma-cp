import {PluginListenerHandle} from "@capacitor/core/types/definitions";
import {Component, NgZone, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";

import {Toast} from "@capacitor/toast";

import {RawRecorder, RecordService} from "../../service/record.service";
import {Iso639Service} from "../../service/iso-639.service";
import {AikumaNative} from "../../native";
import {Record} from "../../record";
import {formatDuration} from "../../utils";


@Component({
	selector: 'page-recording-classic',
	templateUrl: './recording-classic.page.html',
	styleUrls: ['./recording-classic.page.scss'],
})
export class RecordingClassicPage implements OnInit, OnDestroy {

	public formatDuration = formatDuration;

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
		private iso639Service: Iso639Service,
		private router: Router
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

	async ngOnDestroy() {

		this.timeHandle.then(handle => handle.remove());

		if (this.rawRecorder.isStarted()) {
			this.rawRecorder.stop().catch(() => {});
		}

		if (!this.record.hasAudio) {
			console.log("Not recorded, deleting record.");
			await this.recordService.deleteRecord(this.record);
		}

	}

	// Public API //

	async onPauseOrResumeClick() {
		await this.rawRecorder.toggle();
		this.started = this.rawRecorder.isStarted();
		this.paused = this.rawRecorder.isPaused();
	}

	async onSaveClick() {

		await this.rawRecorder.stop();
		this.started = this.rawRecorder.isStarted();
		this.paused = this.rawRecorder.isPaused();

		await Toast.show({
			text: "Successfully saved the audio."
		});

		await this.router.navigateByUrl("/record/" + this.record.dirName, {
			replaceUrl: true
		});

	}

}
