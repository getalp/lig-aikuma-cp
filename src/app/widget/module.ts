import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {LangageSelectComponent} from "./langage-select.component";
import {IonicModule} from "@ionic/angular";
import {SpeakerSelectComponent} from "./speaker-input.component";
import {RecordCardComponent} from "./record-card.component";
import {WaveformEditorComponent} from "./waveform/editor.component";


@NgModule({
	declarations: [
		LangageSelectComponent,
		SpeakerSelectComponent,
		RecordCardComponent,
		WaveformEditorComponent
	],
	imports: [
		CommonModule,
		IonicModule
	],
	exports: [
		LangageSelectComponent,
		SpeakerSelectComponent,
		RecordCardComponent,
		WaveformEditorComponent
	]
})
export class WidgetModule {

}
