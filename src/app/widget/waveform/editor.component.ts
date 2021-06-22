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
	private static readonly MIN_MARKER_DURATION = 5;
	private static readonly MIN_MARKER_SPACE = 1;

	@ViewChild("container")
	private containerRef: ElementRef;
	@ViewChild("canvas")
	private canvasRef: ElementRef;
	@ViewChild("overlayCanvas")
	private overlayCanvasRef: ElementRef;

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
	private waveformData: WaveformData;
	private waveformMaxSample: number = 0;

	// Audio playing data
	private audioBufferSource: AudioBufferSourceNode;
	private audioBufferSourceEndPromise: Promise<void>;
	private startRefTime: number = 0;
	private refTime: number | null = null;
	private refRealTime: number | null = null;
	private updateCursorHandle?: number;

	// Markers
	public markers: WaveformMarker[] = [];
	public selectedMarkerIndex: number | null = null;
	public selectedMarkerCanvasOffsets: [number, number] | null = null;
	public selectedMarkerHandling: "start" | "end" | null = null;

	// Last data
	private lastUri: string;
	private lastTouchDist: number = 0;
	private lastTouchLeft: number = 0;

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
		this.overlayCanvas = this.overlayCanvasRef.nativeElement;
		this.overlayCtx = this.overlayCanvas.getContext("2d");

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

	private static touchEventHorizontalDistance(e: TouchEvent): number {
		return this.touchHorizontalDistance(e.touches[0], e.touches[1]);
	}

	// Canvas Touch //

	canvasTouchStart(e: TouchEvent) {
		if (this.audioBuffer != null) {
			if (e.touches.length === 1) {
				this.lastTouchDist = 0;
				this.lastTouchLeft = e.touches[0].clientX;
				if (this.selectedMarkerCanvasOffsets != null) {
					const canvasX = this.getCanvasX(this.lastTouchLeft);
					const startX = this.selectedMarkerCanvasOffsets[0];
					const endX = this.selectedMarkerCanvasOffsets[1];
					if (canvasX >= startX && canvasX <= startX + 30) {
						this.selectedMarkerHandling = "start";
					} else if (canvasX >= endX - 30 && canvasX <= endX) {
						this.selectedMarkerHandling = "end";
					} else {
						this.selectedMarkerHandling = null;
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
		this.drawIfPossible();
		this.overlayDraw(false);

	}

	canvasClick(e: MouseEvent) {
		if (this.audioBuffer != null) {
			const realWidth = this.canvas.width * this.canvasZoom;
			const touchRatio = (this.canvasOffset + this.getCanvasX(e.clientX)) / realWidth;
			const touchTime = touchRatio * this.audioBuffer.duration;
			if (this.selectedMarkerIndex != null) {
				const selectedMarker = this.markers[this.selectedMarkerIndex];
				if (touchTime < selectedMarker.start || touchTime > selectedMarker.end) {
					this.selectedMarkerIndex = null;
				}
			}
			if (this.selectedMarkerIndex == null) {
				const touchMarkerIndex = this.getMarkerIndexAt(touchTime);
				if (touchMarkerIndex != null) {
					this.selectedMarkerIndex = touchMarkerIndex;
				}
			}
			this.setStartTime(touchTime);
		}
	}

	private getCanvasX(clientX: number): number {
		const canvasRect = this.canvas.getBoundingClientRect();
		return clientX - canvasRect.left;
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
		const audioDuration = this.audioBuffer.duration;

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
				maxSample += channel.max_sample(j);
				minSample += channel.min_sample(j);
			}

			const maxHeight = topHeight * (maxSample / barSamplesFloor / this.waveformMaxSample);
			const minHeight = bottomHeight * (minSample / barSamplesFloor / -this.waveformMaxSample);

			ctx.fillStyle = "#333";
			ctx.fillRect(barOffset, topHeight - maxHeight, barWidth, maxHeight);

			ctx.fillStyle = "#999";
			ctx.fillRect(barOffset, topHeight, barWidth, minHeight);

		}

		ctx.clearRect(0, topHeight - 1, can.width, 1);

		if (this.showTimeTicks || this.showTimeLabels) {

			const optimalTimeInterval = audioDuration / this.canvasZoom / maxTimeTicksCount;
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
		ctx.fillStyle = "#387ffe";
		ctx.globalAlpha = 0.1;
		this.selectedMarkerCanvasOffsets = null;
		for (let i = 0, j = this.markers.length; i < j; ++i) {
			const marker = this.markers[i];
			const selected = (this.selectedMarkerIndex === i);
			const x = marker.start * pixelsPerSecond - this.canvasOffset;
			const width = (marker.end - marker.start) * pixelsPerSecond;
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
		if (this.selectedMarkerCanvasOffsets != null) {
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

		this.drawIfPossible();
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
		this.drawIfPossible();
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
		this.markers.splice(0, this.markers.length);
		this.selectedMarkerIndex = null;
		this.selectedMarkerCanvasOffsets = null;
		this.selectedMarkerHandling = null;
		this.drawIfPossible();
		this.overlayDraw(false);
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

	addMarker(at: number): boolean {

		if (this.audioBuffer == null) {
			return;
		}

		let leftLimit = 0;
		let rightLimit = this.audioBuffer.duration;

		for (let marker of this.markers) {
			if (at >= marker.start && at <= marker.end) {
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

		if (rightLimit - leftLimit < WaveformEditorComponent.MIN_MARKER_DURATION) {
			return false;
		}

		// TODO: Simplifier l'algo (possible je pense)

		let duration = Math.min(rightLimit - leftLimit, this.audioBuffer.duration / 10);
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
			return false;
		}

		this.markers.push(marker);
		this.overlayDraw(false);
		return true;

	}

	addMarkerAtStartTime() {
		this.addMarker(this.startRefTime);
	}

	getSelectedMarker(): WaveformMarker | null {
		return (this.selectedMarkerIndex == null) ? null : this.markers[this.selectedMarkerIndex];
	}

	popSelectedMarker(): WaveformMarker | null {
		if (this.selectedMarkerIndex != null) {
			const marker = this.markers.splice(this.selectedMarkerIndex, 1)[0];
			this.overlayDraw(false);
			return marker;
		}
		return null;
	}

}


export interface WaveformMarker {
	start: number,
	end: number,
}
