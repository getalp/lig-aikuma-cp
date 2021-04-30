import {Component, Input, OnInit, ViewChild} from '@angular/core';
import {Iso639Service, Langage} from "../service/iso-639.service";
import {IonInfiniteScroll} from "@ionic/angular";

@Component({
	selector: 'modal-select-langage',
	templateUrl: './select-langage.component.html',
	styleUrls: ['./select-langage.component.scss'],
})
export class SelectLangageComponent implements OnInit {

	private static readonly GROUP_SIZE = 20;

	@ViewChild(IonInfiniteScroll)
	private infiniteScroll: IonInfiniteScroll;
	private langagesOffset: number = 0;
	private filter: string = "";
	public langages: Langage[] = [];

	constructor(private iso639Service: Iso639Service) { }

	getLangages(): Promise<Langage[]> {
		return this.iso639Service.getLangages();
	}

	doInfinite() {
		this.loadMore().then(end => {
			this.infiniteScroll.complete().then();
			this.infiniteScroll.disabled = end;
		})
	}

	doSearch(e) {
		this.langages = [];
		this.langagesOffset = 0;
		this.filter = e.target.value.toLowerCase();
		this.infiniteScroll.disabled = false;
		this.loadMore().then();
	}

	ngOnInit(): void {
		this.loadMore().then();
	}

	private loadMore(): Promise<boolean> {
		return this.getLangages().then(langages => {
			let added = 0;
			while (added < SelectLangageComponent.GROUP_SIZE && this.langagesOffset < langages.length) {
				const langage = langages[this.langagesOffset++];
				if (this.filter.length === 0 || langage.searchBase.includes(this.filter)) {
					this.langages.push(langage);
					added++;
				}
			}
			return added !== SelectLangageComponent.GROUP_SIZE;
		});
	}

}
