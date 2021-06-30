package org.getalp.ligaikumacp;

import android.Manifest;
import android.content.Context;
import android.media.AudioManager;
import android.media.MediaRecorder;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.StringJoiner;

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

			if (call.getBoolean("cancelLast", false)) {

				this.stopRecorder();
				File file = new File(this.path);
				file.delete();
				this.path = null;
				this.totalTime = 0;

			} else {
				call.reject(ERR_ALREADY_RECORDING);
				return;
			}

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
			} else {
				path = filterFileScheme(path);
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

		this.stopRecorder();

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
		this.path = null;
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

	@PluginMethod
	@SuppressWarnings("unused")
	public void concatAudioAcc(PluginCall call) {

		File cacheDir = this.getContext().getCacheDir();
		int concatUid = (int) (Math.random() * 100000000);

		JSArray segments = call.getArray("segments", null);
		String finalPath = call.getString("path", null);

		if (segments == null || finalPath == null) {
			call.reject("invalid_options");
			return;
		}

		List<File> filesToDelete = new ArrayList<>(segments.length() + 1);
		StringJoiner joiner = new StringJoiner("|", "concat:", "");

		String abort = null;

		for (int i = 0; i < segments.length(); ++i) {
			try {

				JSONObject segment = segments.getJSONObject(i);
				String path = filterFileScheme(segment.getString("path"));
				double from = segment.getDouble("from");
				double to = segment.getDouble("to");

				File file = new File(path);
				if (!file.isFile()) {
					abort = "segment_file_not_found_" + i;
					break;
				}

				File mpegTsDstFile = new File(cacheDir, "concat-segment-" + concatUid + "-" + i + ".ts");
				filesToDelete.add(mpegTsDstFile);

				boolean hasFrom = (from >= 0);
				boolean hasTo = (to > 0);

				// Build arguments
				int j = 0;
				String[] args = new String[5 + (hasFrom ? 2 : 0) + (hasTo ? 2 : 0)];
				args[j++] = "-i";
				args[j++] = file.getAbsolutePath();
				if (hasFrom) {
					args[j++] = "-ss";
					args[j++] = Double.toString(from);
				}
				if (hasTo) {
					args[j++] = "-to";
					args[j++] = Double.toString(to);
				}
				args[j++] = "-c";
				args[j++] = "copy";
				args[j] = mpegTsDstFile.getAbsolutePath();

				// Call FFmpeg
				FFmpegSession session = FFmpegKit.execute(args);

				if (session.getReturnCode().isSuccess()) {
					joiner.add(mpegTsDstFile.getAbsolutePath());
					System.out.println("converted file to: " + mpegTsDstFile.getAbsolutePath());
				} else {
					abort = "segment_file_failed_" + i;
					break;
				}

			} catch (JSONException e) {
				abort = "invalid_options";
				break;
			}
		}

		if (abort == null) {

			File mpegTsFinalFile = new File(cacheDir, "concat-" + concatUid + ".ts");
			filesToDelete.add(mpegTsFinalFile);

			FFmpegSession session = FFmpegKit.execute(new String[]{
				"-i", joiner.toString(),
				"-c", "copy",
				mpegTsFinalFile.getAbsolutePath()
			});

			if (!session.getReturnCode().isSuccess()) {
				abort = "concat_failed";
			} else {

				System.out.println("concatenation done to: " + mpegTsFinalFile.getAbsolutePath());

				File finalFile = new File(filterFileScheme(finalPath));
				finalFile.delete();

				session = FFmpegKit.execute(new String[]{"-i", mpegTsFinalFile.getAbsolutePath(), finalFile.getAbsolutePath()});

				if (!session.getReturnCode().isSuccess()) {
					abort = "final_encoding_failed";
				}

			}

		}

		for (File fileToDelete : filesToDelete) {
			fileToDelete.delete();
		}

		if (abort != null) {
			call.reject(abort);
		} else {
			call.resolve();
		}

	}

	private void stopRecorder() {

		this.recorder.stop();

		if (!this.paused) {
			this.pauseDuration();
		}

		this.recorder.release();
		this.recorder = null;

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

	private static String filterFileScheme(String path) {
		if (path.startsWith("file://")) {
			return path.substring("file://".length());
		} else {
			return path;
		}
	}

}
