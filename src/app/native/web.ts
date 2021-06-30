import {WebPlugin} from '@capacitor/core';

import type {NativePlugin, RecordOptions, RecordInfo, RecordDuration, ConcatAudioOptions} from './definitions';

export class NativePluginWeb extends WebPlugin implements NativePlugin {

	pauseRecording(): Promise<void> {
		return Promise.reject("Not implemented");
	}

	resumeRecording(): Promise<void> {
		return Promise.reject("Not implemented");
	}

	startRecording(_options: RecordOptions): Promise<void> {
		return Promise.reject("Not implemented");
	}

	stopRecording(): Promise<RecordInfo> {
		return Promise.reject("Not implemented");
	}

	getRecordDuration(): Promise<RecordDuration> {
		return Promise.reject("Not implemented");
	}

	concatAudioAcc(options: ConcatAudioOptions): Promise<void> {
		return Promise.reject("Not implemented");
	}

}
