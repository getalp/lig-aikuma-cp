import {NgModule} from '@angular/core';
import {PreloadAllModules, RouterModule, Routes} from '@angular/router';

import {RecordingInfoPage} from "./recording/recording-info.page";
import {HomePage} from "./home/home.page";
import {RecordingClassicPage} from "./recording/recording-classic.page";


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
