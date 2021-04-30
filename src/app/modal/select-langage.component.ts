import {Component, Input, OnInit} from '@angular/core';
import {Iso639Service, Langage} from "../service/iso-639.service";
import {IonInfiniteScroll} from "@ionic/angular";

@Component({
	selector: 'modal-select-langage',
	templateUrl: './select-langage.component.html',
	styleUrls: ['./select-langage.component.scss'],
})
export class SelectLangageComponent implements OnInit {

	private static readonly GROUP_SIZE = 50;

	@Input()
	public selectedLangage?: string;
	public langages: Langage[] = [];

	constructor(private iso639Service: Iso639Service) { }

	getLangages(): Promise<Langage[]> {
		return this.iso639Service.getLangages();
	}

	doInfinite(scroll: IonInfiniteScroll) {
		this.loadMore().then(end => {
			scroll.complete().then();
			scroll.disabled = end;
		})
	}

	private loadMore(): Promise<boolean> {
		return this.getLangages().then(langages => {
			const missing = Math.min(langages.length - this.langages.length, SelectLangageComponent.GROUP_SIZE);
			if (missing > 0) {
				const offset = this.langages.length;
				for (let i = offset, j = i + missing; i < j; ++i) {
					this.langages.push(langages[i]);
				}
			}
			return missing !== SelectLangageComponent.GROUP_SIZE;
		});
	}

	ngOnInit(): void {
		this.loadMore().then();
	}

}
