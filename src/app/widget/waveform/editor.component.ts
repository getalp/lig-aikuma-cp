import {
	AfterViewInit,
	Component,
	ElementRef,
	EventEmitter,
	Input,
	OnDestroy,
	OnInit,
	Output,
	ViewChild
} from "@angular/core";

import {Filesystem} from "@capacitor/filesystem";
import {Toast} from "@capacitor/toast";

import {ResizeSensor} from "css-element-queries";
import WaveformData from "waveform-data";

import {base64ToBuffer, blobToBase64, formatDuration} from "../../utils";
import {Record} from "../../record";


@Component({
	selector: 'app-waveform-editor',
	templateUrl: './editor.component.html',
	styleUrls: ['./editor.component.scss'],
})
export class WaveformEditorComponent implements OnInit, OnDestroy, AfterViewInit {

	private static readonly MIN_ZOOM = 1;
	private static readonly MAX_ZOOM = 6;
	private static readonly MIN_MARKER_DURATION = 5;
	private static readonly MIN_MARKER_SPACE = 1;

	private static readonly MARKER_COLORS = [
		"#387ffe",
		"#5cd42c",
		"#ed9111",
		"#ed3211"
	];

	private static readonly STANDARD_TIME_INTERVALS = [
		0.1, 0.25, 0.5, 1,
		2, 5, 10, 15, 30, 60,
		120, 300, 600, 900, 1800, 3600
	];

	@ViewChild("container")
	private containerRef: ElementRef;
	@ViewChild("canvas")
	private canvasRef: ElementRef;
	@ViewChild("overlayCanvas")
	private overlayCanvasRef: ElementRef;

	@Output()
	public markerSelected = new EventEmitter<[number, WaveformMarker]>();

	@Input()
	public moreControls: (Control | null)[] = [];  // null for spacer

	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private overlayCanvas: HTMLCanvasElement;
	private overlayCtx: CanvasRenderingContext2D;

	private resizeSensor: ResizeSensor;
	private showTimeTicks: boolean = false;
	private showTimeLabels: boolean = false;

	// Audio data
	private audioCtx: AudioContext;
	private audioArray: ArrayBuffer;
	private audioBuffer: AudioBuffer;
	private waveformData: WaveformDataCache;
	public audioLoading: boolean = false;

	// Audio playing data
	private audioBufferSource: AudioBufferSourceNode;
	private audioBufferSourceEndPromise: Promise<void>;
	private startRefTime: number = 0;
	private refTime: number | null = null;
	private refRealTime: number | null = null;
	private updateCursorHandle?: number;

	// Markers
	public canEditMarkers: boolean = false;
	public markers: WaveformMarker[] = [];
	public selectedMarkerIndex: number | null = null;
	public selectedMarkerCanvasOffsets: [number, number] | null = null;
	public selectedMarkerHandling: "start" | "end" | null = null;

	// Last data
	private lastUri: string;
	private lastTouchDist: number = 0;
	private lastTouchLeft: number = 0;

	// Sizes and zoom
	private canvasZoom: number = 1;
	private canvasOffset: number = 0;
	private parentWidth: number = 0;
	private parentHeight: number = 0;

	constructor(
		private element: ElementRef
	) { }

	ngOnInit() {
		const AudioContextCls = window.AudioContext || (window as any).webkitAudioContext;
		this.audioCtx = new AudioContextCls();
		this.canvasZoom = 1;
		this.canvasOffset = 0;
	}

	ngOnDestroy() {
		if (this.resizeSensor != null) {
			this.resizeSensor.detach();
			this.resizeSensor = null;
		}
		this.unload().then();
	}

	ngAfterViewInit(): void {

		this.canvas = this.canvasRef.nativeElement;
		this.ctx = this.canvas.getContext("2d");
		this.overlayCanvas = this.overlayCanvasRef.nativeElement;
		this.overlayCtx = this.overlayCanvas.getContext("2d");

		this.resizeSensor = new ResizeSensor(this.element.nativeElement, size => this.onResized(size));
		this.drawIfPossible().then();

	}

	@Input()
	set src(src: string | Record) {
		if (src instanceof Record) {
			this.loadRecord(src, true).then();
		} else {
			this.loadUri(src).then();
		}
	}

	@Input()
	set timeTicks(enabled: boolean) {
		this.showTimeTicks = enabled;
		this.drawIfPossible().then();
	}

	@Input()
	set timeLabels(enabled: boolean) {
		this.showTimeLabels = enabled;
		this.drawIfPossible().then();
	}

	@Input()
	set markerEdit(enabled: boolean) {
		this.canEditMarkers = enabled;
		this.overlayDraw(false);
	}

	private async drawIfPossible() {
		if (this.audioCtx != null && this.audioArray != null && this.canvas != null) {
			await this.draw();
		}
	}

	private static touchHorizontalDistance(t0: Touch, t1: Touch): number {
		return Math.abs(t0.screenX - t1.screenX);
	}

	private static touchEventHorizontalDistance(e: TouchEvent): number {
		return this.touchHorizontalDistance(e.touches[0], e.touches[1]);
	}

	// Canvas Touch //

	canvasTouchStart(e: TouchEvent) {
		if (this.audioBuffer != null) {
			if (e.touches.length === 1) {
				this.lastTouchDist = 0;
				this.lastTouchLeft = e.touches[0].clientX;
				this.selectedMarkerHandling = null;
				if (this.canEditMarkers && this.selectedMarkerCanvasOffsets != null) {
					const canvasX = this.getCanvasX(this.lastTouchLeft);
					const startX = this.selectedMarkerCanvasOffsets[0];
					const endX = this.selectedMarkerCanvasOffsets[1];
					if (canvasX >= startX && canvasX <= startX + 30) {
						this.selectedMarkerHandling = "start";
					} else if (canvasX >= endX - 30 && canvasX <= endX) {
						this.selectedMarkerHandling = "end";
					}
				}
			} else if (e.touches.length === 2) {
				this.lastTouchDist = WaveformEditorComponent.touchEventHorizontalDistance(e);
				this.lastTouchLeft = e.touches[0].clientX;
			}
		}
	}

	canvasTouchMove(e: TouchEvent) {

		if (this.audioBuffer == null) {
			return;
		}

		if (e.touches.length === 1) {

			const left = e.touches[0].clientX;
			const leftDiff = this.lastTouchLeft - left;
			this.lastTouchLeft = left;

			// Algorithm to change marker limits
			if (this.selectedMarkerHandling != null && this.selectedMarkerIndex != null) {
				const marker = this.markers[this.selectedMarkerIndex];
				const secondsPerPixel = this.audioBuffer.duration / (this.canvasZoom * this.canvas.width);
				const leftDiffInSeconds = leftDiff * secondsPerPixel;
				const minDuration = WaveformEditorComponent.MIN_MARKER_DURATION;
				if (this.selectedMarkerHandling === "start") {
					marker.start -= leftDiffInSeconds;
					if (marker.start > marker.end - minDuration) {
						marker.start = marker.end - minDuration;
					} else {
						let leftLimit = 0;
						for (let otherMarker of this.markers) {
							if (otherMarker.end < marker.end && otherMarker !== marker) {
								if (otherMarker.end > leftLimit) {
									leftLimit = otherMarker.end;
								}
							}
						}
						leftLimit += WaveformEditorComponent.MIN_MARKER_SPACE;
						if (marker.start < leftLimit) {
							marker.start = leftLimit;
						}
					}
				} else if (this.selectedMarkerHandling === "end") {
					marker.end -= leftDiffInSeconds;
					if (marker.end < marker.start + minDuration) {
						marker.end = marker.start + minDuration;
					} else {
						let rightLimit = this.audioBuffer.duration;
						for (let otherMarker of this.markers) {
							if (otherMarker.start > marker.start && otherMarker !== marker) {
								if (otherMarker.start < rightLimit) {
									rightLimit = otherMarker.start;
								}
							}
						}
						rightLimit -= WaveformEditorComponent.MIN_MARKER_SPACE;
						if (marker.end > rightLimit) {
							marker.end = rightLimit;
						}
					}
				}
			} else {
				this.canvasOffset += leftDiff;
			}

		} else if (e.touches.length === 2) {

			const dist = WaveformEditorComponent.touchEventHorizontalDistance(e);
			const left = e.touches[0].clientX;

			if (this.lastTouchDist > 0 && dist > 0) {

				const oldRealWidth = this.canvas.width * this.canvasZoom;

				const distRatio = dist / this.lastTouchDist;
				this.canvasZoom *= distRatio;

				if (this.canvasZoom < WaveformEditorComponent.MIN_ZOOM) {
					this.canvasZoom = WaveformEditorComponent.MIN_ZOOM;
				} else if (this.canvasZoom > WaveformEditorComponent.MAX_ZOOM) {
					this.canvasZoom = WaveformEditorComponent.MAX_ZOOM;
				}

				const realWidth = this.canvas.width * this.canvasZoom;
				const touchLeftRealOffset = this.canvasOffset + this.getCanvasX(this.lastTouchLeft);
				const touchLeftRatio = touchLeftRealOffset / oldRealWidth;
				const canvasSizeDiff = realWidth - oldRealWidth;
				this.canvasOffset += canvasSizeDiff * touchLeftRatio;

				const leftDiff = this.lastTouchLeft - left;
				this.canvasOffset += leftDiff;

			}

			this.lastTouchDist = dist;
			this.lastTouchLeft = left;

		} else {
			return;
		}

		this.fixCanvasOffset();
		this.drawIfPossible().then();
		this.overlayDraw(false);

	}

	canvasClick(e: MouseEvent) {
		if (this.audioBuffer != null) {
			const realWidth = this.canvas.width * this.canvasZoom;
			const touchRatio = (this.canvasOffset + this.getCanvasX(e.clientX)) / realWidth;
			const touchTime = touchRatio * this.audioBuffer.duration;
			this.setStartTime(touchTime);
		}
	}

	private getCanvasX(clientX: number): number {
		const canvasRect = this.canvas.getBoundingClientRect();
		return clientX - canvasRect.left;
	}

	// Draw //

	private async draw() {

		if (this.audioCtx == null) {
			throw "Can't draw since this component is not initialized.";
		} else if (this.audioArray == null) {
			throw "Can't draw if audio was not previously loaded.";
		}

		const data = await this.ensureWaveformData();
		this.internalDraw(data);

	}

	private async ensureWaveformData(): Promise<WaveformDataCache> {

		if (this.waveformData != null) {
			return this.waveformData;
		}

		/*const cachePath = (this.lastUri != null) ? ("waveform-data-" + Math.abs(getStringHashCode(this.lastUri)) + ".dat") : null;

		if (cachePath != null) {
			await Toast.show({text: "Cache path: " + cachePath});
			try {
				const cachedData = await Filesystem.readFile({
					directory: Directory.Cache,
					path: cachePath
				});
				this.waveformData = await WaveformDataCache.decodeFromBase64(cachedData.data);
				await Toast.show({text: "Loaded cache."});
				return this.waveformData;
			} catch (e) {}
		}

		await Toast.show({text: "Loading raw..."});*/

		const config: any = {
			scale: 512,
			audio_context: this.audioCtx,
			array_buffer: this.audioArray
		};

		return new Promise((resolve, reject) => {
			WaveformData.createFromAudio(config, (error, waveformData, audioBuffer) => {
				if (error != null) {
					reject(error);
				} else {

					this.setStartTime(this.startRefTime);

					const dataCache = new WaveformDataCache(waveformData.length);
					const channel = waveformData.channel(0);
					for (let i = 0; i < waveformData.length; ++i) {
						dataCache.setSample(i, -channel.min_sample(i), channel.max_sample(i));
					}

					this.audioBuffer = audioBuffer;
					this.waveformData = dataCache;
					resolve(dataCache);

				}
			});
		});

		/*if (cachePath != null) {
			try {
				await Toast.show({text: "Saving cached data."});
				const encodedData = await dataCache.encodeToBase64();
				await Filesystem.writeFile({
					directory: Directory.Cache,
					path: cachePath,
					data: encodedData
				});
				await Toast.show({text: "Saved cached data."});
			} catch (e) {}
		}

		return dataCache;*/

	}

	private internalDraw(data: WaveformDataCache) {

		// Drawing constants
		const barWidth = 2;
		const barSpace = 2;
		const barTotalWidth = barWidth + barSpace;
		const middlePos = 0.66;
		const maxTimeTicksCount = 8;

		const can = this.canvas;
		const ctx = this.ctx;

		ctx.clearRect(0, 0, can.width, can.height);

		// const channel = data.channel(0);
		const audioDuration = this.audioBuffer.duration;

		const realWidth = this.canvasZoom * can.width;
		const realOffset = this.canvasOffset;

		const barCount = Math.ceil((realWidth + barSpace) / barTotalWidth);
		const barSamples = data.length / barCount;
		const barSamplesFloor = Math.ceil(barSamples);

		const topHeight = Math.floor(can.height * middlePos);
		const bottomHeight = can.height - topHeight;

		/*let overallMaxSample = 0;

		for (let i = 0; i < data.length; ++i) {
			const maxSample = channel.max_sample(i);
			const minSample = -channel.min_sample(i);
			if (maxSample > overallMaxSample) {
				overallMaxSample = maxSample;
			}
			if (minSample > overallMaxSample) {
				overallMaxSample = minSample;
			}
		}*/

		for (let i = 0; i < barCount; ++i) {

			const barOffset = i * barTotalWidth - realOffset;

			if (barOffset + barWidth < 0 || barOffset >= can.width)
				continue;

			let maxSample = 0;
			let minSample = 0;

			for (let j = Math.floor(i * barSamples), k = j + barSamplesFloor; j < k; ++j) {
				if (j >= data.length) {
					// Si les calcules précédent sont erronés (très fréquent), on arrête tout simplement la boucle for parent.
					i = barCount;
					break;
				}
				maxSample += data.getMaxSample(j);
				minSample += data.getMinSample(j);
			}

			const maxHeight = topHeight * (maxSample / barSamplesFloor / data.overallMaxSample);
			const minHeight = bottomHeight * (minSample / barSamplesFloor / data.overallMaxSample);

			ctx.fillStyle = "#333";
			ctx.fillRect(barOffset, topHeight - maxHeight, barWidth, maxHeight);

			ctx.fillStyle = "#999";
			ctx.fillRect(barOffset, topHeight, barWidth, minHeight);

		}

		ctx.clearRect(0, topHeight - 1, can.width, 1);

		if (this.showTimeTicks || this.showTimeLabels) {

			const optimalTimeInterval = audioDuration / this.canvasZoom / maxTimeTicksCount;
			let realTimeInterval = Math.ceil(optimalTimeInterval);

			for (let interval of WaveformEditorComponent.STANDARD_TIME_INTERVALS) {
				if (optimalTimeInterval < interval) {
					realTimeInterval = interval;
					break;
				}
			}

			const pixelsPerSecond = realWidth / audioDuration;

			ctx.strokeStyle = "#999";
			ctx.textAlign = "center";
			ctx.font = "11px Arial";
			ctx.lineWidth = 1;

			const durationPrecision = (realTimeInterval < 1) ? 2 : 0;

			ctx.beginPath();
			for (let factor = 1, time, dur = audioDuration; (time = factor * realTimeInterval) < dur; factor++) {
				const x = time * pixelsPerSecond - realOffset;
				if (x >= 0 && x < can.width) {
					if (this.showTimeTicks) {
						ctx.moveTo(x, can.height);
						ctx.lineTo(x, can.height - 10);
						ctx.stroke();
					}
					if (this.showTimeLabels) {
						ctx.fillText(formatDuration(time, durationPrecision), x, can.height - (this.showTimeTicks ? 15 : 7));
					}
				}
			}
			ctx.closePath();

		}

	}

	private overlayDraw(ensureCursorOffset: boolean) {

		const can = this.overlayCanvas;
		const ctx = this.overlayCtx;

		if (can == null) {
			return;
		}

		ctx.clearRect(0, 0, can.width, can.height);

		if (this.audioBuffer == null) {
			return;
		}

		const pixelsPerSecond = (this.canvasZoom * can.width) / this.audioBuffer.duration;

		// Compute cursor positions first
		const startCursorPosition = this.startRefTime * pixelsPerSecond;
		const realTime = (this.refTime == null) ? null : this.refTime + (this.refRealTime == null ? 0 : (this.audioCtx.currentTime - this.refRealTime));
		const cursorPosition = (realTime == null) ? null : realTime * pixelsPerSecond;

		// Ensure offset before drawing
		if (ensureCursorOffset) {
			this.ensureCanvasOffsetTo((cursorPosition == null) ? startCursorPosition : cursorPosition);
		}

		// Markers
		const markerColors = WaveformEditorComponent.MARKER_COLORS;
		// ctx.fillStyle = "#387ffe";
		ctx.globalAlpha = 0.1;
		this.selectedMarkerCanvasOffsets = null;
		for (let i = 0, j = this.markers.length; i < j; ++i) {
			const marker = this.markers[i];
			const selected = (this.selectedMarkerIndex === i);
			const x = marker.start * pixelsPerSecond - this.canvasOffset;
			const width = (marker.end - marker.start) * pixelsPerSecond;
			ctx.fillStyle = markerColors[i % markerColors.length];
			if (selected) {
				ctx.globalAlpha = 0.2;
				this.selectedMarkerCanvasOffsets = [x, x + width];
			}
			ctx.fillRect(x, 0, width, can.height);
			if (selected) {
				ctx.globalAlpha = 0.1;
			}
		}
		ctx.globalAlpha = 1.0;

		// Start cursor
		ctx.fillStyle = "#ababab";
		ctx.fillRect(startCursorPosition - 1 - this.canvasOffset, 0, 2, can.height);

		// Time cursor
		if (cursorPosition != null) {
			ctx.fillStyle = "#387ffe";
			ctx.fillRect(cursorPosition - 1 - this.canvasOffset, 0, 2, can.height);
		}

		// Selected marker handles
		if (this.canEditMarkers && this.selectedMarkerCanvasOffsets != null) {
			const startX = this.selectedMarkerCanvasOffsets[0];
			const endX = this.selectedMarkerCanvasOffsets[1];
			const midHeight = can.height / 2;
			ctx.fillStyle = "#555555";
			ctx.fillRect(startX, midHeight - 50, 20, 100);
			ctx.fillRect(endX - 20, midHeight - 50, 20, 100);
			ctx.strokeStyle = "#dddddd";
			ctx.beginPath();
			ctx.moveTo(startX + 12, midHeight - 10);
			ctx.lineTo(startX + 12, midHeight + 10);
			ctx.moveTo(startX + 8, midHeight - 10);
			ctx.lineTo(startX + 8, midHeight + 10);
			ctx.moveTo(endX - 12, midHeight - 10);
			ctx.lineTo(endX - 12, midHeight + 10);
			ctx.moveTo(endX - 8, midHeight - 10);
			ctx.lineTo(endX - 8, midHeight + 10);
			ctx.closePath();
			ctx.stroke();
		}

	}

	// Zoom and Size //

	private onResized({width, height}: { width: number; height: number }) {
		this.parentWidth = width;
		this.parentHeight = height;
		this.updateCanvasSize();
	}

	private updateCanvasSize() {

		// Je n'ai pas réussit à utiliser les propriété directement dans le template, le rafraichissement était bugué.
		this.canvas.width = this.parentWidth;
		this.canvas.height = this.parentHeight;
		this.overlayCanvas.width = this.parentWidth;
		this.overlayCanvas.height = this.parentHeight;

		this.fixCanvasOffset();

		this.drawIfPossible().then();
		this.overlayDraw(false);

	}

	private getMaxCanvasOffset(): number {
		return Math.max(0, this.canvas.width * (this.canvasZoom - 1));
	}

	private fixCanvasOffset() {
		if (this.canvasOffset < 0) {
			this.canvasOffset = 0;
		} else {
			const maxOffset = this.getMaxCanvasOffset();
			if (this.canvasOffset > maxOffset) {
				this.canvasOffset = maxOffset;
			}
		}
	}

	private ensureCanvasOffsetTo(offset: number) {
		const offsetLeft = this.canvasOffset;
		const offsetRight = this.canvasOffset + this.canvas.width;
		if (offset < offsetLeft) {
			this.canvasOffset = offset - this.parentWidth + 30;
		} else if (offset > offsetRight) {
			this.canvasOffset = offset - 30;
		} else {
			return;
		}
		this.fixCanvasOffset();
		this.drawIfPossible().then();
	}

	// Common for public API //

	private stopAudioBufferSource(): Promise<void> {
		this.audioBufferSource.disconnect();
		this.audioBufferSource.stop();
		this.audioBufferSource = null;
		const endPromise = this.audioBufferSourceEndPromise;
		this.audioBufferSourceEndPromise = null;
		return endPromise;
	}

	// Internal Cursor //

	private scheduleUpdateCursor() {
		this.updateCursorHandle = window.setInterval(() => {
			this.overlayDraw(true);
		}, 10);
	}

	private stopUpdateCursor() {
		window.clearInterval(this.updateCursorHandle);
		this.updateCursorHandle = null;
	}

	// Public API //

	async loadUri(uri: string | null) {
		if (uri == null) {
			await this.unload();
		} else if (uri !== this.lastUri || this.audioArray == null) {
			if (uri.startsWith("file://") || uri.startsWith("/")) {
				await Filesystem.readFile({
					path: uri
				}).then(res => {
					return base64ToBuffer(res.data);
				}).then(buf => {
					this.lastUri = uri;
					return this.loadAudioArrayInternal(buf);
				});
			} else if (uri.startsWith("http://") || uri.startsWith("https://")) {
				await fetch(uri)
					.then(res => res.arrayBuffer())
					.then(buf => {
						this.lastUri = uri;
						return this.loadAudioArrayInternal(buf);
					});
			} else {
				throw "Invalid URI protocol for audio file (" + uri + ").";
			}
		}
	}

	async loadRecord(record: Record, loadMarkers: boolean = false) {
		await this.loadUri(record.getAudioUri());
		if (loadMarkers) {
			this.addMarkersUnsafeFromRecord(record);
		}
	}

	async loadAudioArray(buf: ArrayBuffer) {
		this.lastUri = null;
		await this.loadAudioArrayInternal(buf);
	}

	async unload() {
		this.lastUri = null;
		await this.loadAudioArrayInternal(null);
	}

	private async loadAudioArrayInternal(buf: ArrayBuffer) {
		await this.stop();
		this.audioLoading = true;
		this.audioArray = buf;
		this.waveformData = null; // Reset the waveform data to force computation.
		this.audioBuffer = null;
		this.markers.splice(0, this.markers.length);
		this.setSelectedMarkerIndex(null);
		await this.drawIfPossible();
		this.overlayDraw(false);
		this.audioLoading = false;
	}

	isLoaded(): boolean {
		return this.waveformData != null;
	}

	isPlaying(): boolean {
		// Retourne true si la lecture du son est en cours.
		return this.refTime != null;
	}

	isPaused(): boolean {
		// Retourne true si la lecture du son est en cours mais a été mis en pause.
		return this.refTime != null && this.refRealTime == null;
	}

	isNotPaused(): boolean {
		return this.refTime != null && this.refRealTime != null;
	}

	async play() {

		// Si la lecture est en cours mais pas en pause, on stop au préalable.
		if (this.refTime != null && this.refRealTime != null) {
			await this.stop();
		}

		if (this.audioBuffer != null) {

			const source = this.audioCtx.createBufferSource();
			this.audioBufferSource = source;

			source.connect(this.audioCtx.destination);
			source.buffer = this.audioBuffer;

			this.audioBufferSourceEndPromise = new Promise((resolve, _reject) => {
				source.addEventListener("ended", async () => {
					// On force l'arrêt uniquement si la source n'a pas été mise en pause.
					if (this.refRealTime != null) {
						await this.stop();
					}
					resolve();
				});
			});

			if (this.refTime == null) {
				this.refTime = this.startRefTime;
			}

			source.start(null, this.refTime);
			this.refRealTime = this.audioCtx.currentTime;
			this.scheduleUpdateCursor();

		} else {
			throw "No audio buffer to play.";
		}

	}

	async pause() {
		if (this.refTime != null && this.refRealTime != null) {
			this.stopUpdateCursor();
			this.refTime += this.audioCtx.currentTime - this.refRealTime;
			this.refRealTime = null;
			await this.stopAudioBufferSource();
		}
	}

	async stop(): Promise<void> {
		if (this.refTime != null) {
			const wasPaused = (this.refRealTime == null);
			this.refTime = null;
			this.refRealTime = null;
			this.overlayDraw(false);
			if (!wasPaused) {
				this.stopUpdateCursor();
				await this.stopAudioBufferSource();
			}
		}
	}

	// Time

	async setTime(duration: number) {
		const wasPlaying = (this.refTime != null && this.refRealTime != null);
		await this.stop();
		this.refTime = duration;
		this.refRealTime = null;
		if (wasPlaying) {
			await this.play();
		}
	}

	// Start time

	setStartTime(time: number) {

		if (time < 0) {
			time = 0;
		} else if (this.audioBuffer != null && time > this.audioBuffer.duration) {
			time = this.audioBuffer.duration;
		}

		let selectedMarkerIndex = this.selectedMarkerIndex;
		if (selectedMarkerIndex != null) {
			const selectedMarker = this.markers[selectedMarkerIndex];
			if (time < selectedMarker.start || time > selectedMarker.end) {
				selectedMarkerIndex = null;
			}
		}

		if (selectedMarkerIndex == null) {
			const touchMarkerIndex = this.getMarkerIndexAt(time);
			if (touchMarkerIndex != null) {
				selectedMarkerIndex = touchMarkerIndex;
			}
		}

		if (selectedMarkerIndex !== this.selectedMarkerIndex) {
			this.setSelectedMarkerIndex(selectedMarkerIndex);
		}

		this.startRefTime = time;
		this.overlayDraw(true);

	}

	getStartTime(): number {
		return this.startRefTime;
	}

	moveStartTime(delta: number) {
		this.setStartTime(this.startRefTime + delta);
	}

	// Markers

	private getMarkerIndexAt(time: number): number | null {
		for (let i = 0, j = this.markers.length; i < j; ++i) {
			const marker = this.markers[i];
			if (time >= marker.start && time <= marker.end) {
				return i;
			}
		}
		return null;
	}

	private setSelectedMarkerIndex(index: number | null) {
		if (index < 0 || index >= this.markers.length) {
			index = null;
		}
		this.selectedMarkerIndex = index;
		if (index == null) {
			this.selectedMarkerCanvasOffsets = null;
			this.selectedMarkerHandling = null;
			this.markerSelected.emit(null);
		} else {
			this.markerSelected.emit([index, this.markers[index]]);
		}
	}

	addMarker(at: number): boolean {

		if (this.audioBuffer == null) {
			return false;
		}

		let leftLimit = 0;
		let rightLimit = this.audioBuffer.duration;

		for (let marker of this.markers) {
			if (at >= marker.start && at <= marker.end) {
				console.warn("Can't add marker: In marker.");
				return false;
			} else if (at < marker.start) {
				if (marker.start < rightLimit) {
					rightLimit = marker.start;
				}
			} else if (at > marker.end) {
				if (marker.end > leftLimit) {
					leftLimit = marker.end;
				}
			}
		}

		leftLimit += WaveformEditorComponent.MIN_MARKER_SPACE;
		rightLimit -= WaveformEditorComponent.MIN_MARKER_SPACE;

		console.debug("leftLimit: " + leftLimit + ", rightLimit: " + rightLimit);

		if (rightLimit - leftLimit < WaveformEditorComponent.MIN_MARKER_DURATION) {
			console.warn("Can't add marker: Not enough preview space (" + (rightLimit - leftLimit) + ").");
			return false;
		}

		let duration = Math.min(rightLimit - leftLimit, Math.max(WaveformEditorComponent.MIN_MARKER_DURATION, this.audioBuffer.duration / 10));

		console.debug("duration: " + duration);

		const marker: WaveformMarker = {
			start: at - duration / 2,
			end: at + duration / 2
		};

		const needStartShift = (marker.start <= leftLimit);
		if (needStartShift) {
			const diff = leftLimit - marker.start;
			marker.start += diff;
			marker.end = marker.start + duration;
		}

		if (marker.end >= rightLimit) {
			const diff = marker.end - rightLimit;
			if (!needStartShift) {
				marker.start -= diff;
			} else {
				duration -= diff;
			}
			marker.end = marker.start + duration;
		}

		if (marker.end - marker.start < WaveformEditorComponent.MIN_MARKER_DURATION) {
			console.warn("Can't add marker: Not enough final space (" + (marker.end - marker.start) + ").");
			return false;
		}

		this.markers.push(marker);
		this.setSelectedMarkerIndex(this.markers.length - 1);
		this.overlayDraw(false);
		return true;

	}

	addMarkerAtStartTime(): boolean {
		return this.addMarker(this.startRefTime);
	}

	addMarkersUnsafe(markers: WaveformMarker[]) {
		this.markers.push(...markers);
		this.overlayDraw(false);
	}

	addMarkersUnsafeFromRecord(record: Record) {
		this.addMarkersUnsafe(record.markers.map(recordMarker => {
			return {start: recordMarker.start, end: recordMarker.end};
		}));
	}

	getSelectedMarker(): WaveformMarker | null {
		return (this.selectedMarkerIndex == null) ? null : this.markers[this.selectedMarkerIndex];
	}

	popSelectedMarker(): WaveformMarker | null {
		if (this.selectedMarkerIndex != null) {
			const marker = this.markers.splice(this.selectedMarkerIndex, 1)[0];
			this.setSelectedMarkerIndex(null);
			this.overlayDraw(false);
			return marker;
		}
		return null;
	}

	clearMarkers() {
		this.markers.splice(0, this.markers.length);
		this.setSelectedMarkerIndex(null);
		this.overlayDraw(false);
	}

	getMarkers(): WaveformMarker[] {
		return this.markers;
	}

	// Callback for internal use

	async onAddMarkerClick() {
		if (!this.addMarkerAtStartTime()) {
			await Toast.show({text: "Failed to a marker, not enough space!"});
		}
	}
	async onRemoveMarkerClick() {
		this.popSelectedMarker();
	}

	// For template

	onControlClick(control: Control, event: MouseEvent) {
		if (control != null) {
			control.click(event);
		}
	}

}


export interface WaveformMarker {
	start: number,
	end: number,
}

interface Control {
	icon: string;
	click?: ((ev: MouseEvent) => any) | null;
}


class WaveformDataCache {

	public overallMaxSample: number = 0;

	constructor(public readonly length: number, private readonly samples: Uint8Array = null) {
		const doubleLength = this.length << 1;
		if (this.samples == null || this.samples.length !== doubleLength) {
			this.samples = new Uint8Array(doubleLength);
		}
	}

	setSample(idx: number, min: number, max: number) {
		idx <<= 1;
		this.samples[idx] = min;
		this.samples[idx + 1] = max;
		if (min > this.overallMaxSample) this.overallMaxSample = min;
		if (max > this.overallMaxSample) this.overallMaxSample = max;
	}

	getMinSample(idx: number): number {
		return this.samples[idx << 1];
	}

	getMaxSample(idx: number): number {
		return this.samples[(idx << 1) + 1];
	}

	encodeToBase64(): Promise<string> {
		return blobToBase64(new Blob([
			new Uint32Array([this.length, this.overallMaxSample]),
			this.samples
		], {
			type: "application/octet-stream"
		}));
	}

	static decodeFromBase64(base64: string): Promise<WaveformDataCache> {
		const buf = base64ToBuffer(base64);
		const header = new Uint32Array(buf, 0, 8);
		const samples = new Uint8Array(buf, 8);
		const data = new WaveformDataCache(header[0], samples);
		data.overallMaxSample = header[1];
		return Promise.resolve(data);
	}

}
