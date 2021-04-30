import {Component} from '@angular/core';
import {ModalController} from "@ionic/angular";

import {SelectLangageComponent} from "../modal/select-langage.component";

@Component({
	selector: 'app-home',
	templateUrl: './home.page.html',
	styleUrls: ['./home.page.scss'],
})
export class HomePage {

	constructor(private modalCtl: ModalController) { }

	testModal(): Promise<void> {
		return this.modalCtl.create({
			component: SelectLangageComponent
		}).then(r => {
			return r.present();
		});
	}

}
