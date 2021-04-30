import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";

@Injectable({
	providedIn: 'root'
})
export class Iso639Service {

	private static readonly LANG_FILE = "assets/iso-639-3-names.tab";
	private static readonly LANG_ENCODING = "ISO-8859-1";

	private cache?: Promise<Langage[]>;

	constructor(private http: HttpClient) { }

	getLangages(): Promise<Langage[]> {
		if (this.cache == null) {
			this.cache = new Promise((resolve, reject) => {
				this.http.get(Iso639Service.LANG_FILE, {
					responseType: "arraybuffer"
				}).subscribe(value => {
					const textDecoder = new TextDecoder(Iso639Service.LANG_ENCODING);
					const text = textDecoder.decode(value);
					const lines = text.split("\n");
					const langages: Langage[] = [];
					for (let i = 1; i < lines.length; ++i) {
						const parts = lines[i].split("\t");
						langages.push({
							code: parts[0],
							printName: parts[1],
							searchBase: parts[0].toLowerCase() + parts[1].toLowerCase()
						});
					}
					resolve(langages);
				}, error => {
					reject(error);
				})
			});
		}
		return this.cache;
	}

}

export interface Langage {
	code: string;
	printName: string;
	searchBase: string;
}
