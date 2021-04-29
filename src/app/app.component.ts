import {Component} from '@angular/core';

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
})
export class AppComponent {

	public pages = [
		{title: 'Home', url: '/home', icon: 'home'},
		{title: 'Recording', url: '/recording', icon: 'mic'},
		{title: 'Respeaking', url: '/respeaking', icon: 'volume-high'},
		{title: 'Translating', url: '/translating', icon: 'earth'},
		{title: 'Elicitation', url: '/elicitation', icon: 'images'},
	];

	constructor() { }

}
