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

@NgModule({
	declarations: [
		AppComponent,
		SelectLangageModal,
		SelectSpeakerModal,
		CreateSpeakerModal
	],
	entryComponents: [],
	imports: [
		BrowserModule,
		IonicModule.forRoot(),
		AppRoutingModule,
		HttpClientModule
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
