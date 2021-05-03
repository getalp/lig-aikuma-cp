import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

import {IonicModule} from '@ionic/angular';

import {RecordingPageRoutingModule} from './recording-routing.module';

import {RecordingPage} from './recording.page';
import {WidgetModule} from "../widget/module";


@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		IonicModule,
		RecordingPageRoutingModule,
		WidgetModule
	],
	declarations: [RecordingPage]
})
export class RecordingPageModule {
}
