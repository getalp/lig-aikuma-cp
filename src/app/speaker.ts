export enum Gender {
	Male = "male",
	Female = "female",
	Unknown = "unknown"
}

export class Speaker {

	public nativeLanguage: string;
	public otherLanguages: string[];
	public regionOfOrigin: string;
	public notes: string;
	public yearOfBirth: number;
	public gender: Gender = Gender.Unknown;

	constructor(public uid: string, public name: string) { }

	public apply(other: Speaker) {
		this.name = other.name;
		this.nativeLanguage = other.nativeLanguage;
		this.otherLanguages = other.otherLanguages;
		this.regionOfOrigin = other.regionOfOrigin;
		this.notes = other.notes;
		this.yearOfBirth = other.yearOfBirth;
		this.gender = other.gender;
	}

}
