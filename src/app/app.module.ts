import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {RouteReuseStrategy} from '@angular/router';
import {HttpClientModule} from "@angular/common/http";

import {IonicModule, IonicRouteStrategy} from '@ionic/angular';

import {AppComponent} from './app.component';
import {AppRoutingModule} from './app-routing.module';
import {SelectLangageModal} from "./modal/select-langage.component";
import {SelectSpeakerModal} from "./modal/select-speaker.component";
import {CreateSpeakerModal} from "./modal/create-speaker.component";
import {WidgetModule} from "./widget/module";
import {FormsModule} from "@angular/forms";
import {HomePage} from "./page/home/home.page";
import {RecordingInfoPage} from "./page/recording/recording-info.page";
import {RecordingClassicPage} from "./page/recording/recording-classic.page";
import {RecordsPage} from "./page/records/records.page";
import {RecordPage} from "./page/records/record.page";
import {MarkPage} from "./page/mark/mark.page";


@NgModule({
	declarations: [
		AppComponent,
		// Home
		HomePage,
		// Recording
		RecordingInfoPage,
		RecordingClassicPage,
		// Mark
		MarkPage,
		// Records
		RecordsPage,
		RecordPage,
		// Modals
		SelectLangageModal,
		SelectSpeakerModal,
		CreateSpeakerModal
	],
	entryComponents: [],
    imports: [
        BrowserModule,
        IonicModule.forRoot(),
        AppRoutingModule,
        HttpClientModule,
		FormsModule,
        WidgetModule
    ],
	providers: [
		{
			provide: RouteReuseStrategy,
			useClass: IonicRouteStrategy
		}
	],
	bootstrap: [AppComponent],
})
export class AppModule {
}
