import {NgModule} from '@angular/core';
import {PreloadAllModules, RouterModule, Routes} from '@angular/router';

import {RecordingInfoPage} from "./page/recording/recording-info.page";
import {HomePage} from "./page/home/home.page";
import {RecordingClassicPage} from "./page/recording/recording-classic.page";
import {RecordsPage} from "./page/records/records.page";
import {RecordPage} from "./page/records/record.page";


const routes: Routes = [
	{
		path: "",
		redirectTo: "home",
		pathMatch: "full"
	},
	{
		path: "home",
		component: HomePage
	},
	{
		path: "recording/classic/:recordDirName",
		component: RecordingClassicPage
	},
	{
		path: "recording",
		component: RecordingInfoPage
	},
	{
		path: "records",
		component: RecordsPage
	},
	{
		path: "record/:recordDirName",
		component: RecordPage
	}
];


@NgModule({
	imports: [
		RouterModule.forRoot(routes, {preloadingStrategy: PreloadAllModules})
	],
	exports: [RouterModule]
})
export class AppRoutingModule {

}
