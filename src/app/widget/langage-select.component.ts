import {Component, Input, Output, EventEmitter} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {SelectLangageModal} from "../modal/select-langage.component";
import {Iso639Service, Language} from "../service/iso-639.service";


@Component({
	selector: 'app-langage-select',
	template: '<ion-button #button (click)="onClick()">{{ text }}</ion-button>'
})
export class LangageSelectComponent {

	private static readonly NO_SELECT_TEXT = "Select";

	@Input() optional: boolean | "" = false;
	@Output() langageSelected = new EventEmitter<Language>();
	@Output() langChanged = new EventEmitter<string>();

	private langage?: Language;
	public text: string = LangageSelectComponent.NO_SELECT_TEXT;

	constructor(
		private iso639Service: Iso639Service,
		private modalCtl: ModalController
	) { }

	onClick() {

		this.modalCtl.create({
			component: SelectLangageModal,
			componentProps: {
				"optional": this.optional === "" || this.optional
			}
		}).then(r => {
			return r.present().then(() => {
				r.onWillDismiss().then(value => {
					if (value.data != null) {
						this.setLangage(value.data.langage, true);
					}
				});
			});
		});
	}

	@Input()
	set lang(langageCode: string) {
		this.iso639Service.getLanguage(langageCode).then(lang => {
			this.setLangage(lang, false);
		});
	}

	private setLangage(lang: Language, emitChange: boolean) {
		this.langage = lang;
		this.text = (lang == null) ? LangageSelectComponent.NO_SELECT_TEXT : this.langage.printName;
		this.langageSelected.emit(lang);
		if (emitChange) {
			this.langChanged.emit(lang?.code);
		}
	}

}
