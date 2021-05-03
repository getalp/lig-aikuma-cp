import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {LangageSelectComponent} from "./langage-select.component";
import {IonicModule} from "@ionic/angular";
import {SpeakerSelectComponent} from "./speaker-input.component";


@NgModule({
	declarations: [
		LangageSelectComponent,
		SpeakerSelectComponent
	],
	imports: [
		CommonModule,
		IonicModule
	],
	exports: [
		LangageSelectComponent,
		SpeakerSelectComponent
	]
})
export class WidgetModule {

}
