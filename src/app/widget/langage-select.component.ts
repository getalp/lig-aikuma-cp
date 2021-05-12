import {Component, Input, Output, EventEmitter} from '@angular/core';
import {ModalController} from "@ionic/angular";
import {SelectLangageModal} from "../modal/select-langage.component";
import {Iso639Service, Language} from "../service/iso-639.service";


@Component({
	selector: 'app-langage-select',
	template: '<ion-button #button (click)="onClick()" [disabled]="modalOpened">{{ text }}</ion-button>'
})
export class LangageSelectComponent {

	private static readonly NO_SELECT_TEXT = "Select";

	@Input() optional: boolean | "" = false;
	@Output() langCodeChanged = new EventEmitter<string>();
	@Output() langChanged = new EventEmitter<Language>();

	private langage?: Language;
	public text: string = LangageSelectComponent.NO_SELECT_TEXT;
	public modalOpened: boolean = false;

	constructor(
		private iso639Service: Iso639Service,
		private modalCtl: ModalController
	) { }

	async onClick() {
		if (!this.modalOpened) {
			this.modalOpened = true;
			try {
				const modal = await this.modalCtl.create({
					component: SelectLangageModal,
					componentProps: {
						"optional": this.optional === "" || this.optional
					}
				});
				modal.present().then();
				const detail = await modal.onWillDismiss();
				if (detail.data != null) {
					this.setLangage(detail.data.langage, true);
				}
			} finally {
				this.modalOpened = false;
			}
		}
	}

	@Input()
	set langCode(langageCode: string) {
		this.iso639Service.getLanguage(langageCode).then(lang => {
			this.setLangage(lang, false);
		});
	}

	private setLangage(lang: Language, emitChange: boolean) {
		this.langage = lang;
		this.text = (lang == null) ? LangageSelectComponent.NO_SELECT_TEXT : this.langage.printName;
		this.langChanged.emit(lang);
		if (emitChange) {
			this.langCodeChanged.emit(lang?.code);
		}
	}

}
