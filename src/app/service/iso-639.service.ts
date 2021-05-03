import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";


interface CacheData {
	list: Langage[];
	associated: { [key: string]: Langage };
}


@Injectable({
	providedIn: 'root'
})
export class Iso639Service {

	private static readonly LANG_FILE = "assets/iso-639-3-names.tab";
	private static readonly LANG_ENCODING = "ISO-8859-1";

	private cache?: Promise<CacheData>;

	constructor(private http: HttpClient) { }

	private getCache(): Promise<CacheData> {
		if (this.cache == null) {
			this.cache = new Promise((resolve, reject) => {
				this.http.get(Iso639Service.LANG_FILE, {
					responseType: "arraybuffer"
				}).subscribe(value => {
					const textDecoder = new TextDecoder(Iso639Service.LANG_ENCODING);
					const text = textDecoder.decode(value);
					const lines = text.split("\n");
					const langages: Langage[] = [];
					const langagesAssociated = {};
					for (let i = 1; i < lines.length; ++i) {
						const parts = lines[i].split("\t");
						const lang = {
							code: parts[0],
							printName: parts[1],
							searchBase: parts[0].toLowerCase() + parts[1].toLowerCase()
						};
						langages.push(lang);
						langagesAssociated[lang.code] = lang;
					}
					resolve({
						list: langages,
						associated: langagesAssociated
					});
				}, error => {
					reject(error);
				})
			});
		}
		return this.cache;
	}

	getLangages(): Promise<Langage[]> {
		return this.getCache().then(data => data.list);
	}

	getAssociatedLangages(): Promise<{ [key: string]: Langage }> {
		return this.getCache().then(data => data.associated);
	}

	getLangage(code: string): Promise<Langage> {
		return this.getAssociatedLangages().then(langages => {
			return langages[code];
		});
	}

}

export interface Langage {
	code: string;
	printName: string;
	searchBase: string;
}
