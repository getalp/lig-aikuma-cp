
import {Plugin, PluginListenerHandle} from "@capacitor/core/types/definitions";

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

export interface NativePlugin extends Plugin {

	/**
	 * Standardized rejects:
	 * - MISSING_PERMISSION
	 * - ALREADY_RECORDING
	 * - MICROPHONE_NOT_AVAILABLE
	 * - INVALID_PATH
	 */
	startRecording(options: RecordOptions): Promise<void>;

	/**
	 * Standardized rejects:
	 * - NOT_RECORDING
	 */
	pauseRecording(): Promise<void>;

	/**
	 * Standardized rejects:
	 * - NOT_RECORDING
	 */
	resumeRecording(): Promise<void>;

	/**
	 * Standardized rejects:
	 * - NOT_RECORDING
	 */
	stopRecording(): Promise<RecordInfo>;

	getRecordDuration(): Promise<RecordDuration>;

	addListener(eventName: "recordDuration", listenerFunc: (duration: RecordDuration) => void): Promise<PluginListenerHandle>;

}
