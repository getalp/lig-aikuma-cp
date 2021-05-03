import {Component} from '@angular/core';


@Component({
	selector: 'app-home',
	templateUrl: './home.page.html',
	styleUrls: ['./home.page.scss'],
})
export class HomePage {

	public buttons = [
		{
			title: "Recording",
			children: [
				{title: "Recording", icon: "mic", router: {link: "/recording"}},
				{title: "Elicitation", icon: "images", router: {link: "/elicitation"}},
			]
		},
		{
			title: "Editing",
			children: [
				{title: "Respeaking", icon: "volume-high"},
				{title: "Translating", icon: "earth"},
			]
		}
	];

	constructor() {

	}

}
