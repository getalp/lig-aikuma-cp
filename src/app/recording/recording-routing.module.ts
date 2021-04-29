import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';

import {RecordingPage} from './recording.page';

const routes: Routes = [
	{
		path: '',
		component: RecordingPage
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class RecordingPageRoutingModule {
}
