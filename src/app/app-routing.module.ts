import {NgModule} from '@angular/core';
import {PreloadAllModules, RouterModule, Routes} from '@angular/router';

import {RecordingInfoPage} from "./page/recording/recording-info.page";
import {HomePage} from "./page/home/home.page";
import {RecordingClassicPage} from "./page/recording/recording-classic.page";
import {RecordsPage} from "./page/records/records.page";


const routes: Routes = [
	{
		path: '',
		redirectTo: 'home',
		pathMatch: 'full'
	},
	{
		path: 'home',
		component: HomePage
		// loadChildren: () => import('./home/home.module').then(m => m.HomePageModule)
	},
	{
		path: 'recording/classic/:recordDirName',
		component: RecordingClassicPage
	},
	{
		path: 'recording',
		component: RecordingInfoPage
		// loadChildren: () => import('./recording/recording.module').then(m => m.RecordingPageModule)
	},
	{
		path: 'records',
		component: RecordsPage
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
