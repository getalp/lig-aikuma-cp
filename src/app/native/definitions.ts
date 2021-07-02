
import {Plugin, PluginListenerHandle} from "@capacitor/core/types/definitions";

export interface RecordOptions {
	path: string,
	cancelLast?: boolean
}

export interface RecordInfo {
	path: string,
	duration: number
}

export interface RecordDuration {
	duration: number
}

export interface ConcatAudioOptions {
	path: string,
	segments: ConcatAudioSegment[]
}

export interface ConcatAudioSegment {
	path: string,
	from: number, // seconds with decimals, -1 <=> from start
	to: number    // seconds with decimals, -1 <=> to end
}

export interface NativePlugin extends Plugin {

	/**
	 * Standardized rejects:
	 * - NOT_SUPPORTED (web-only)
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

	/**
	 * Standardized rejects:
	 * - NOT_RECORDING
	 */
	getRecordDuration(): Promise<RecordDuration>;

	concatAudioAcc(options: ConcatAudioOptions): Promise<void>;

	addListener(eventName: "recordDuration", listenerFunc: (duration: RecordDuration) => void): Promise<PluginListenerHandle>;

}
