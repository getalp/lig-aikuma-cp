import {Component, Input, ElementRef, OnInit, OnDestroy, AfterViewInit, ViewChild} from "@angular/core";

import {Filesystem} from "@capacitor/filesystem";

import {ResizeSensor} from "css-element-queries";
import WaveformData from "waveform-data";
import {base64ToBuffer, formatDuration} from "../../utils";


@Component({
	selector: 'app-waveform-editor',
	templateUrl: './editor.component.html',
	styleUrls: ['./editor.component.scss'],
})
export class WaveformEditorComponent implements OnInit, OnDestroy, AfterViewInit {

	private static readonly MIN_ZOOM = 1;
	private static readonly MAX_ZOOM = 6;

	@ViewChild("container")
	private containerRef: ElementRef;

	@ViewChild("canvas")
	private canvasRef: ElementRef;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private resizeSensor: ResizeSensor;
	private showTimeTicks: boolean = false;
	private showTimeLabels: boolean = false;

	// Audio data
	private audioCtx: AudioContext;
	private audioArray: ArrayBuffer;
	private audioBuffer: AudioBuffer;
	private waveformData: WaveformData;
	private waveformMaxSample: number = 0;

	// Audio playing data
	private audioBufferSource: AudioBufferSourceNode;
	private audioBufferSourceEndPromise: Promise<void>;
	private startRefTime: number = 0;
	private refTime: number | null = null;
	private refRealTime: number | null = null;
	private updateCursorHandle?: number;

	// Exposed cursors positions;
	public startCursorPosition: number = 0;
	public cursorPosition: number = 0;

	// Markers
	public markers: InternalWaveformMarker[] = [];
	public selectedMarker: number | null = null;
	private markerMoveHandle: number | null = null;

	// Last data
	private lastUri: string;
	private lastTouchDist: number = 0;
	private lastTouchMiddle: number = 0;

	// Sizes and zoom
	private canvasZoom: number = 2;
	private canvasOffset: number = 0;
	private parentWidth: number = 0;
	private parentHeight: number = 0;

	constructor(
		private element: ElementRef
	) { }

	ngOnInit() {
		const AudioContextCls = window.AudioContext || (window as any).webkitAudioContext;
		this.audioCtx = new AudioContextCls();
	}

	ngOnDestroy() {
		if (this.resizeSensor != null) {
			this.resizeSensor.detach();
			this.resizeSensor = null;
		}
	}

	ngAfterViewInit(): void {
		this.canvas = this.canvasRef.nativeElement;
		this.ctx = this.canvas.getContext("2d");
		this.resizeSensor = new ResizeSensor(this.element.nativeElement, size => this.onResized(size));
		this.drawIfPossible();
	}

	@Input()
	set uri(uri: string) {
		this.load(uri).then();
	}

	@Input()
	set timeTicks(enabled: boolean) {
		this.showTimeTicks = enabled;
		this.drawIfPossible();
	}

	@Input()
	set timeLabels(enabled: boolean) {
		this.showTimeLabels = enabled;
		this.drawIfPossible();
	}

	private drawIfPossible() {
		if (this.audioCtx != null && this.audioArray != null) {
			this.draw();
		}
	}

	private static touchHorizontalDistance(t0: Touch, t1: Touch): number {
		return Math.abs(t0.screenX - t1.screenX);
	}

	private static touchHorizontalMiddle(t0: Touch, t1: Touch): number {
		return (t0.screenX + t1.screenX) / 2;
	}

	private static touchEventHorizontalDistance(e: TouchEvent): number {
		return this.touchHorizontalDistance(e.touches[0], e.touches[1]);
	}

	private static touchEventHorizontalMiddle(e: TouchEvent): number {
		return this.touchHorizontalMiddle(e.touches[0], e.touches[1]);
	}

	// Canvas Touch //

	canvasTouchStart(e: TouchEvent) {
		if (e.touches.length === 1) {
			this.lastTouchDist = 0;
			this.lastTouchMiddle = e.touches[0].clientX;
		} else if (e.touches.length === 2) {
			this.lastTouchDist = WaveformEditorComponent.touchEventHorizontalDistance(e);
			this.lastTouchMiddle = WaveformEditorComponent.touchEventHorizontalMiddle(e);
		}
	}

	canvasTouchMove(e: TouchEvent) {

		let dist = 0, middle = null;

		if (e.touches.length === 1) {
			middle = e.touches[0].clientX;
		} else if (e.touches.length === 2) {
			dist = WaveformEditorComponent.touchEventHorizontalDistance(e);
			middle = WaveformEditorComponent.touchEventHorizontalMiddle(e);
		}

		if (middle != null) {

			if (this.lastTouchDist > 0 && dist > 0) {

				const distRatio = dist / this.lastTouchDist;
				this.lastTouchDist = dist;
				this.canvasZoom *= distRatio;

				const lastMiddleRatio = 1 - (this.getCanvasX(this.lastTouchMiddle) / this.canvas.width);
				const canvasSizeDiff = this.canvas.width * (distRatio - 1);
				this.canvasOffset += canvasSizeDiff * lastMiddleRatio;

				console.log(
					"distRatio: " + distRatio.toFixed(4) +
					", lastMiddleRatio: " + lastMiddleRatio.toFixed(2) +
					", canvasSizeDiff: " + canvasSizeDiff.toFixed(2) +
					", addToOffset: " + (canvasSizeDiff * lastMiddleRatio).toFixed(3));

				if (this.canvasZoom < WaveformEditorComponent.MIN_ZOOM) {
					this.canvasZoom = WaveformEditorComponent.MIN_ZOOM;
				} else if (this.canvasZoom > WaveformEditorComponent.MAX_ZOOM) {
					this.canvasZoom = WaveformEditorComponent.MAX_ZOOM;
				}

			}

			const middleDiff = this.lastTouchMiddle - middle;
			this.canvasOffset += middleDiff;
			this.lastTouchMiddle = middle;

			this.fixCanvasOffset();
			this.drawIfPossible();

			/*if (distRatio != null) {
				this.canvasOffset *= distRatio;
			}*/

		}

	}

	canvasClick(e: MouseEvent) {
		if (this.audioBuffer != null) {
			const touchRatio = this.getCanvasX(e.clientX) / this.canvas.width;
			this.setStartTime(touchRatio * this.audioBuffer.duration);
		}
	}

	private getCanvasX(clientX: number): number {
		const canvasRect = this.canvas.getBoundingClientRect();
		return clientX - canvasRect.left;
	}

	// Marker Touch //

	markerClicked(markerIndex: number) {
		if (this.selectedMarker === markerIndex) {
			this.selectedMarker = null;
		} else {
			this.selectedMarker = markerIndex;
		}
	}

	// Draw //

	private draw() {

		if (this.audioCtx == null) {
			throw "Can't draw since this component is not initialized.";
		} else if (this.audioArray == null) {
			throw "Can't draw if audio was not previously loaded.";
		}

		this.ensureWaveformData()
			.then(data => {
				this.internalDraw(data);
			});

	}

	private ensureWaveformData(): Promise<WaveformData> {

		if (this.waveformData != null) {
			return Promise.resolve(this.waveformData);
		}

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

					this.waveformData = waveformData;
					this.audioBuffer = audioBuffer;

					this.setStartTime(this.startRefTime);

					this.waveformMaxSample = 0;

					const channel = waveformData.channel(0);
					for (let i = 0; i < waveformData.length; ++i) {
						const maxSample = channel.max_sample(i);
						const minSample = -channel.min_sample(i);
						if (maxSample > this.waveformMaxSample)
							this.waveformMaxSample = maxSample;
						if (minSample > this.waveformMaxSample)
							this.waveformMaxSample = minSample;
					}

					resolve(waveformData);

				}
			});
		});

	}

	private internalDraw(data: WaveformData) {

		// Drawing constants
		const barWidth = 2;
		const barSpace = 2;
		const barTotalWidth = barWidth + barSpace;
		const middlePos = 0.66;
		const maxTimeTicksCount = 8;

		const can = this.canvas;
		const ctx = this.ctx;

		ctx.clearRect(0, 0, can.width, can.height);

		const channel = data.channel(0);

		const realWidth = this.canvasZoom * can.width;
		const realOffset = this.canvasOffset;

		const barCount = Math.ceil((realWidth + barSpace) / barTotalWidth);
		const barSamples = data.length / barCount;
		const barSamplesFloor = Math.ceil(barSamples);

		const topHeight = Math.floor(can.height * middlePos);
		const bottomHeight = can.height - topHeight;

		let overallMaxSample = 0;

		for (let i = 0; i < data.length; ++i) {
			const maxSample = channel.max_sample(i);
			const minSample = -channel.min_sample(i);
			if (maxSample > overallMaxSample) {
				overallMaxSample = maxSample;
			}
			if (minSample > overallMaxSample) {
				overallMaxSample = minSample;
			}
		}

		for (let i = 0; i < barCount; ++i) {

			let maxSample = 0;
			let minSample = 0;

			for (let j = Math.floor(i * barSamples), k = j + barSamplesFloor; j < k; ++j) {
				if (j >= data.length) {
					// Si les calcules précédent sont erronés (très fréquent), on arrête tout simplement la boucle for parent.
					i = barCount;
					break;
				}
				maxSample += channel.max_sample(j);
				minSample += channel.min_sample(j);
			}

			const maxHeight = topHeight * (maxSample / barSamplesFloor / this.waveformMaxSample);
			const minHeight = bottomHeight * (minSample / barSamplesFloor / -this.waveformMaxSample);

			ctx.fillStyle = "#333";
			ctx.fillRect(i * barTotalWidth - realOffset, topHeight - maxHeight, barWidth, maxHeight);

			ctx.fillStyle = "#999";
			ctx.fillRect(i * barTotalWidth - realOffset, topHeight, barWidth, minHeight);

		}

		ctx.clearRect(0, topHeight - 1, can.width, 1);

		if (this.showTimeTicks || this.showTimeLabels) {

			const optimalTimeInterval = this.audioBuffer.duration / this.canvasZoom / maxTimeTicksCount;
			const realTimeInterval =
				(optimalTimeInterval < 0.1) ? 0.1 :
				(optimalTimeInterval < 0.25) ? 0.25 :
				(optimalTimeInterval < 0.5) ? 0.5 :
				(optimalTimeInterval < 1) ? 1 :
				(optimalTimeInterval < 2) ? 2 :
				(optimalTimeInterval < 5) ? 5 :
				(optimalTimeInterval < 10) ? 10 :
				(optimalTimeInterval < 15) ? 15 :
				(optimalTimeInterval < 30) ? 30 :
				(optimalTimeInterval < 60) ? 60 :
				Math.ceil(optimalTimeInterval);

			const pixelsPerSecond = realWidth / this.audioBuffer.duration;

			ctx.strokeStyle = "#999";
			ctx.textAlign = "center";
			ctx.font = "11px Arial";
			ctx.lineWidth = 1;

			const durationPrecision = (realTimeInterval < 1) ? 2 : 0;

			for (let factor = 1, time, dur = this.audioBuffer.duration; (time = factor * realTimeInterval) < dur; factor++) {
				const x = time * pixelsPerSecond - realOffset;
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

	}

	// Zoom and Size //

	private onResized({width, height}: { width: number; height: number }) {
		this.parentWidth = width;
		this.parentHeight = height;
		this.updateCanvasSize();
	}

	private updateCanvasSize() {

		// const containerElement = this.containerRef.nativeElement as HTMLElement;
		// const oldCenter = (containerElement.scrollLeft + (this.parentWidth / 2)) / this.canvas.width;

		// Je n'ai pas réussit à utiliser les propriété directement dans le template, le rafraichissement était bugué.
		// this.canvas.width = Math.floor(this.parentWidth * this.canvasZoom);
		this.canvas.width = this.parentWidth;
		this.canvas.height = this.parentHeight;

		// On met à jour le scroll pour que le zoom se fasse par rapport au centre de l'écran.
		// containerElement.scrollLeft = (oldCenter * this.canvas.width) - (this.parentWidth / 2);

		this.fixCanvasOffset();

		this.updateCursor();
		this.updateStartCursor();
		this.updateMarkers();

		this.drawIfPossible();

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

	private ensureScrollTo(position: number) {

		const containerElement = this.containerRef.nativeElement as HTMLElement;
		const scrollStart = containerElement.scrollLeft;
		const scrollEnd = scrollStart + this.parentWidth;

		if (position < scrollStart) {
			containerElement.scrollLeft = position - this.parentWidth + 30;
		} else if (position > scrollEnd) {
			containerElement.scrollLeft = position - 30;
		}

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

	// Common for all cursors //

	private computeCursorOffset(time: number): number {
		if (this.audioBuffer != null) {
			return time / this.audioBuffer.duration * this.canvas.width;
		} else {
			return 0;
		}
	}

	// Internal Cursor //

	private scheduleUpdateCursor() {
		this.updateCursorHandle = window.setInterval(() => {
			this.updateCursor(true);
		}, 10);
	}

	private stopUpdateCursor() {
		window.clearInterval(this.updateCursorHandle);
		this.updateCursorHandle = null;
	}

	private updateCursor(ensureScroll: boolean = false) {

		if (this.refTime != null && this.audioBuffer != null) {
			const realTime = this.refTime + (this.refRealTime == null ? 0 : (this.audioCtx.currentTime - this.refRealTime));
			this.cursorPosition = this.computeCursorOffset(realTime);
		} else {
			this.cursorPosition = 0;
		}

		if (ensureScroll) {
			this.ensureScrollTo(this.cursorPosition);
		}

	}

	private updateStartCursor(ensureScroll: boolean = false) {
		this.startCursorPosition = this.computeCursorOffset(this.startRefTime);
		if (ensureScroll) {
			this.ensureScrollTo(this.startCursorPosition);
		}
	}

	// Internal Markers //

	private updateMarkers() {
		for (let marker of this.markers) {
			marker.offset = this.computeCursorOffset(marker.start);
			marker.width = this.computeCursorOffset(marker.end) - marker.offset;
		}
	}

	private isMarkerHover(marker: InternalWaveformMarker) {
		return this.startRefTime >= marker.start && this.startRefTime < marker.end;
	}

	private updateMarkerHover() {
		/*for (let marker of this.markers) { TODO
			marker.hover = this.isMarkerHover(marker);
		}*/
	}

	// Public API //

	async load(uri: string) {
		if (uri !== this.lastUri || this.audioArray == null) {
			if (uri.startsWith("file://") || uri.startsWith("/")) {
				await Filesystem.readFile({
					path: uri
				}).then(res => {
					return base64ToBuffer(res.data);
				}).then(buf => {
					this.lastUri = uri;
					return this.loadAudioArray(buf);
				});
			} else if (uri.startsWith("http://") || uri.startsWith("https://")) {
				await fetch(uri)
					.then(res => res.arrayBuffer())
					.then(buf => {
						this.lastUri = uri;
						return this.loadAudioArray(buf);
					});
			} else {
				throw "Invalid URI protocol for audio file (" + uri + ").";
			}
		}
	}

	async loadAudioArray(buf: ArrayBuffer) {
		await this.stop();
		this.audioArray = buf;
		this.waveformData = null; // Reset the waveform data to force computation.
		this.audioBuffer = null;
		this.drawIfPossible();
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
			if (wasPaused) {
				// this.updateCursor(true);
			} else {
				this.stopUpdateCursor();
				// this.updateCursor(true);
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

		this.startRefTime = time;
		this.updateStartCursor(!this.isPlaying());
		this.updateMarkerHover();

	}

	getStartTime(): number {
		return this.startRefTime;
	}

	moveStartTime(delta: number) {
		this.setStartTime(this.startRefTime + delta);
	}

	// Markers

	addMarker(start: number, end: number, autoShrink: boolean = true): boolean {

		if (autoShrink) {
			for (let marker of this.markers) {
				if (start >= marker.start && start <= marker.end) {
					return false;
				} else if (end > marker.start && start < marker.end) {
					end = marker.start;
				}
			}
		} else {
			for (let marker of this.markers) {
				if (start < marker.end && end > marker.start) {
					return false;
				}
			}
		}

		const startOffset = this.computeCursorOffset(start);

		// marker.hover = this.isMarkerHover(marker); TODO
		this.selectedMarker = this.markers.length;
		this.markers.push({
			start: start,
			end: end,
			offset: this.computeCursorOffset(start),
			width: this.computeCursorOffset(end) - startOffset
		});

		return true;

	}

	addMarkerAtStartTime(duration: number) {
		this.addMarker(this.startRefTime, this.startRefTime + duration);
	}

	getSelectedMarker(): WaveformMarker {
		return this.markers[this.selectedMarker];
	}

	/*getSelectedMarkers(): WaveformMarker[] {
		return this.markers.filter(marker => marker.hover);
	}

	removeSelectedMarkers() {
		this.markers = this.markers.filter(marker => !marker.hover);
	}*/

	moveSelectedMarkers(delta: number) {
		/*for (let marker of this.markers) {
			if (marker.hover) {
				marker.start += delta
				marker.end += delta;
			}
		}
		this.updateMarkers();
		this.moveStartTime(delta);*/
	}

}


export interface WaveformMarker {
	start: number,
	end: number,
}


interface InternalWaveformMarker extends WaveformMarker {
	offset: number,
	width: number
}
