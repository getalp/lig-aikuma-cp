import {Component} from '@angular/core';


@Component({
	selector: 'page-home',
	templateUrl: './home.page.html',
	styleUrls: ['./home.page.scss'],
})
export class HomePage {

	public buttons = [
		{
			title: "Recording",
			children: [
				{title: "Recording", icon: "mic", router: {link: "/recording-info/classic"}},
				{title: "Elicitation", icon: "images", router: {link: "/recording-info/elicitation"}, disabled: true},
			]
		},
		{
			title: "Editing",
			children: [
				{title: "Records", icon: "list", router: {link: "/records"}}
			]
		}
	];

	constructor() { }

}
