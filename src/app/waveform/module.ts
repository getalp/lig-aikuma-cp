import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {WaveformEditorComponent} from "./editor.component";
import {IonicModule} from "@ionic/angular";


@NgModule({
	declarations: [
		WaveformEditorComponent
	],
	imports: [
		CommonModule,
		IonicModule
	],
	exports: [
		WaveformEditorComponent
	]
})
export class WaveformModule {

}
