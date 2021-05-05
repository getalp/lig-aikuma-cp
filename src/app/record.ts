import {Speaker} from "./speaker";
import {Language} from "./service/iso-639.service";


export class Record {

	public notes: string = "";
	public date: Date = new Date();

	constructor(
		public speaker: Speaker,
		public language: Language
	) { }

}
