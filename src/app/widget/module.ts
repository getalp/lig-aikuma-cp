import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {LangageSelectComponent} from "./langage-select.component";
import {IonicModule} from "@ionic/angular";
import {SpeakerSelectComponent} from "./speaker-input.component";
import {RecordCardComponent} from "./record-card.component";
import {WaveformEditorComponent} from "./waveform/editor.component";
import {RecordsListComponent} from "./records-list.component";
import {AppRoutingModule} from "../app-routing.module";


@NgModule({
	declarations: [
		LangageSelectComponent,
		SpeakerSelectComponent,
		RecordCardComponent,
		WaveformEditorComponent,
		RecordsListComponent
	],
	imports: [
		CommonModule,
		IonicModule,
		AppRoutingModule
	],
	exports: [
		LangageSelectComponent,
		SpeakerSelectComponent,
		RecordCardComponent,
		WaveformEditorComponent,
		RecordsListComponent
	]
})
export class WidgetModule {
	// Nothing
}
