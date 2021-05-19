import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {LangageSelectComponent} from "./langage-select.component";
import {IonicModule} from "@ionic/angular";
import {SpeakerSelectComponent} from "./speaker-input.component";
import {RecordCardComponent} from "./record-card.component";


@NgModule({
	declarations: [
		LangageSelectComponent,
		SpeakerSelectComponent,
		RecordCardComponent
	],
	imports: [
		CommonModule,
		IonicModule
	],
	exports: [
		LangageSelectComponent,
		SpeakerSelectComponent,
		RecordCardComponent
	]
})
export class WidgetModule {

}
