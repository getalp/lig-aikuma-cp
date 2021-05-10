
export interface RecordOptions {
	path: string
}

export interface RecordInfo {
	path: string,
	duration: number
}

export interface RecordDuration {
	duration: number
}

export interface NativePlugin {
	startRecording(options: RecordOptions): Promise<void>;
	pauseRecording(): Promise<void>;
	resumeRecording(): Promise<void>;
	stopRecording(): Promise<RecordInfo>;
	getRecordDuration(): Promise<RecordDuration>;
}
