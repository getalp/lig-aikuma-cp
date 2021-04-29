import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {IonicModule} from '@ionic/angular';

import {RecordingPage} from './recording.page';

describe('RecordingPage', () => {
	let component: RecordingPage;
	let fixture: ComponentFixture<RecordingPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [RecordingPage],
			imports: [IonicModule.forRoot()]
		}).compileComponents();

		fixture = TestBed.createComponent(RecordingPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
