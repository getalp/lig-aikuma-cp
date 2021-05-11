package org.getalp.ligaikumacp;

import android.Manifest;
import android.content.Context;
import android.media.AudioManager;
import android.media.MediaRecorder;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;

@CapacitorPlugin(
	name = "AikumaNative",
	permissions = {
		@Permission(
			alias = "recording",
			strings = {
				Manifest.permission.RECORD_AUDIO,
				Manifest.permission.WRITE_EXTERNAL_STORAGE
			}
		)
	}
)
public class NativePlugin extends Plugin {

	private static final String ERR_NOT_RECORDING               = "NOT_RECORDING";
	private static final String ERR_ALREADY_RECORDING           = "ALREADY_RECORDING";
	private static final String ERR_MICROPHONE_NOT_AVAILABLE    = "MICROPHONE_NOT_AVAILABLE";
	private static final String ERR_INVALID_PATH                = "INVALID_PATH";
	private static final String ERR_MISSING_PERMISSION          = "MISSING_PERMISSION";

	private MediaRecorder recorder;
	private String path;

	private boolean paused;
	private long totalTime;
	private long startTime;

	private Thread durationThread;

	@PluginMethod
	public void startRecording(PluginCall call) {

		if (!this.isRecordingAllowed()) {
			requestPermissionForAlias("recording", call, "startRecordingPermissionCallback");
			return;
		}

		if (this.recorder != null) {
			call.reject(ERR_ALREADY_RECORDING);
			return;
		}

		if (!this.isMicrophoneAvailable()) {
			call.reject(ERR_MICROPHONE_NOT_AVAILABLE);
			return;
		}

		try {

			String path = call.getString("path");

			if (path == null) {
				call.reject(ERR_INVALID_PATH);
				return;
			} else if (path.startsWith("file://")) {
				path = path.substring("file://".length());
			}

			this.recorder = new MediaRecorder();
			this.recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
			this.recorder.setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS);
			this.recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
			this.recorder.setAudioSamplingRate(32000);
			this.recorder.setAudioEncodingBitRate(32000);
			this.recorder.setOutputFile(path);
			this.recorder.prepare();
			this.recorder.start();

			this.path = path;

			this.paused = false;
			this.totalTime = 0;
			this.resumeDuration();

			if (this.durationThread == null) {
				this.durationThread = new Thread(this::runDurationThread);
				this.durationThread.setDaemon(true);
				this.durationThread.start();
			}

			call.resolve();

		} catch (IOException e) {
			call.reject(e.getLocalizedMessage(), e);
			this.recorder = null;
		}

	}

	@PermissionCallback
	public void startRecordingPermissionCallback(PluginCall call) {
		if (this.isRecordingAllowed()) {
			this.startRecording(call);
		} else {
			call.reject(ERR_MISSING_PERMISSION);
		}
	}

	@PluginMethod
	@SuppressWarnings("unused")
	public void pauseRecording(PluginCall call) {
		if (this.recorder != null) {
			if (!this.paused) {
				this.recorder.pause();
				this.paused = true;
				this.pauseDuration();
				this.notifyDurationListeners();
			}
			call.resolve();
		} else {
			call.reject(ERR_NOT_RECORDING);
		}
	}

	@PluginMethod
	@SuppressWarnings("unused")
	public void resumeRecording(PluginCall call) {
		if (this.recorder != null) {
			if (this.paused) {
				this.recorder.resume();
				this.paused = false;
				this.resumeDuration();
			}
			call.resolve();
		} else {
			call.reject(ERR_NOT_RECORDING);
		}
	}

	@PluginMethod
	@SuppressWarnings("unused")
	public void stopRecording(PluginCall call) {

		if (this.recorder == null) {
			call.reject(ERR_NOT_RECORDING);
			return;
		}

		this.recorder.stop();

		if (!this.paused) {
			this.pauseDuration();
		}

		this.recorder.release();
		this.recorder = null;

		try {
			this.durationThread.join(1000);
		} catch (InterruptedException e) {
			e.printStackTrace();
		} finally {
			this.durationThread = null;
		}

		JSObject obj = new JSObject();
		obj.put("path", this.path);
		obj.put("duration", this.totalTime * 1e-9D);
		this.totalTime = 0;
		this.notifyDurationListeners();

		call.resolve(obj);

	}

	@PluginMethod
	@SuppressWarnings("unused")
	public void getRecordDuration(PluginCall call) {
		if (this.recorder == null) {
			call.reject(ERR_NOT_RECORDING);
		} else {
			JSObject obj = new JSObject();
			obj.put("duration", this.getDuration());
			call.resolve(obj);
		}
	}

	private void runDurationThread() {
		while (this.recorder != null) {
			if (!this.paused) {
				this.notifyDurationListeners();
			}
			try {
				Thread.sleep(100);
			} catch (InterruptedException e) {
				break;
			}
		}
	}

	private void notifyDurationListeners() {
		JSObject obj = new JSObject();
		obj.put("duration", this.getDuration());
		this.notifyListeners("recordDuration", obj);
	}

	private void resumeDuration() {
		this.startTime = System.nanoTime();
	}

	private void pauseDuration() {
		this.totalTime += System.nanoTime() - this.startTime;
		this.startTime = 0;
	}

	private double getDuration() {
		if (this.startTime == 0) {
			return this.totalTime * 1e-9D;
		} else {
			return (this.totalTime + System.nanoTime() - this.startTime) * 1e-9D;
		}
	}

	private boolean isRecordingAllowed() {
		return getPermissionState("recording") == PermissionState.GRANTED;
	}

	private boolean isMicrophoneAvailable() {
		AudioManager manager = (AudioManager) this.getContext().getSystemService(Context.AUDIO_SERVICE);
		return manager != null && manager.getMode() == AudioManager.MODE_NORMAL;
	}

}
