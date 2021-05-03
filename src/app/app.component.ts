import {Component} from '@angular/core';
// import {HomePage} from "./home/home.page";

@Component({
	selector: 'app-root',
	// template: '<ion-app><ion-nav [root]="rootPage"></ion-nav></ion-app>',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
})
export class AppComponent {

	/*public pages = [
		{title: 'Home', url: '/home', icon: 'home'},
		{title: 'Recording', url: '/recording', icon: 'mic'},
		{title: 'Respeaking', url: '/respeaking', icon: 'volume-high'},
		{title: 'Translating', url: '/translating', icon: 'earth'},
		{title: 'Elicitation', url: '/elicitation', icon: 'images'},
	];*/

	// public rootPage: any = HomePage;

	constructor() { }

}
