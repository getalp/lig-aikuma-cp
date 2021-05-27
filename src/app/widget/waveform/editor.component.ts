import {Component, Input, ElementRef, OnInit, OnDestroy, AfterViewInit, ViewChild} from "@angular/core";

import {Filesystem} from "@capacitor/filesystem";

import {ResizeSensor} from "css-element-queries";
import WaveformData from "waveform-data";
import {base64ToBuffer} from "../../utils";


@Component({
	selector: 'app-waveform-editor',
	templateUrl: './editor.component.html',
	styleUrls: ['./editor.component.scss'],
})
export class WaveformEditorComponent implements OnInit, OnDestroy, AfterViewInit {

	private static readonly MIN_ZOOM = 1;
	private static readonly MAX_ZOOM = 10;

	@ViewChild("container")
	private containerRef: ElementRef;

	@ViewChild("canvas")
	private canvasRef: ElementRef;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private resizeSensor: ResizeSensor;

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

	// Last data
	private lastUri: string;
	private lastTouchDist: number = 0;

	// Sizes and zoom
	private canvasZoom: number = 1;
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
		if (this.audioArray != null) {
			this.draw();
		}
	}

	@Input()
	set uri(uri: string) {
		this.load(uri).then();
	}

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

	private static touchHorizontalDistance(t0: Touch, t1: Touch): number {
		return Math.abs(t0.screenX - t1.screenX);
	}

	private static touchEventHorizontalDistance(e: TouchEvent): number {
		return this.touchHorizontalDistance(e.touches[0], e.touches[1]);
	}

	canvasTouchStart(e: TouchEvent) {
		if (e.touches.length === 2) {
			this.lastTouchDist = WaveformEditorComponent.touchEventHorizontalDistance(e);
		}
	}

	canvasTouchMove(e: TouchEvent) {
		if (e.touches.length === 2) {
			const dist = WaveformEditorComponent.touchEventHorizontalDistance(e);
			const ratio = dist / this.lastTouchDist;
			this.lastTouchDist = dist;
			this.canvasZoom *= ratio;
			if (this.canvasZoom < WaveformEditorComponent.MIN_ZOOM) {
				this.canvasZoom = WaveformEditorComponent.MIN_ZOOM;
			} else if (this.canvasZoom > WaveformEditorComponent.MAX_ZOOM) {
				this.canvasZoom = WaveformEditorComponent.MAX_ZOOM;
			}
			this.updateCanvasSize();
			this.draw();
		}
	}

	private ensureWaveformData(): Promise<WaveformData> {

		if (this.waveformData != null) {
			return Promise.resolve(this.waveformData);
		}

		const config: any = {
			scale: 256,
			audio_context: this.audioCtx,
			array_buffer: this.audioArray
		};

		/*if (this.audioBuffer != null) {
		  config.audio_buffer = this.audioBuffer;
		} else {
		  config.audio_context = this.audioCtx;
		  config.array_buffer = this.audioArray;
		}*/

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

		const can = this.canvas;
		const ctx = this.ctx;

		const barWidth = 3;
		const barSpace = 2;

		ctx.clearRect(0, 0, can.width, can.height);

		const channel = data.channel(0);

		const barCount = Math.ceil((can.width + barSpace) / (barWidth + barSpace));
		const barSamples = data.length / barCount;
		const barSamplesFloor = Math.floor(barSamples);

		const topHeight = Math.floor(can.height * 0.66);
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
			ctx.fillRect(i * (barWidth + barSpace), topHeight - maxHeight, barWidth, maxHeight);

			ctx.fillStyle = "#999";
			ctx.fillRect(i * (barWidth + barSpace), topHeight, barWidth, minHeight);

		}

		ctx.clearRect(0, topHeight - 1, can.width, 1);

	}

	private onResized({width, height}: { width: number; height: number }) {
		this.parentWidth = width;
		this.parentHeight = height;
		this.updateCanvasSize();
		if (this.audioArray != null) {
			this.draw();
		}
	}

	private updateCanvasSize() {
		// Je n'ai pas réussit à utiliser les propriété directement dans le template, le rafraichissement était bugué.
		this.canvas.width = Math.floor(this.parentWidth * this.canvasZoom);
		this.canvas.height = this.parentHeight;
		this.updateCursor();
		this.updateStartCursor();
		this.updateMarkers();
	}

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
			this.updateCursor();
		}, 10);
	}

	private stopUpdateCursor() {
		window.clearInterval(this.updateCursorHandle);
		this.updateCursorHandle = null;
	}

	private updateCursor() {
		if (this.refTime != null && this.audioBuffer != null) {
			const realTime = this.refTime + (this.refRealTime == null ? 0 : (this.audioCtx.currentTime - this.refRealTime));
			this.cursorPosition = this.computeCursorOffset(realTime);
		} else {
			this.cursorPosition = 0;
		}
	}

	private updateStartCursor() {
		this.startCursorPosition = this.computeCursorOffset(this.startRefTime);
	}

	// Internal Markers //

	private updateMarkers() {
		for (let marker of this.markers) {
			marker.offset = this.computeCursorOffset(marker.start);
			marker.width = this.computeCursorOffset(marker.end) - marker.offset;
		}
	}

	private isMarkerHover(marker: InternalWaveformMarker) {
		return this.startRefTime >= marker.start && this.startRefTime <= marker.end;
	}

	private updateMarkerHover() {
		for (let marker of this.markers) {
			marker.hover = this.isMarkerHover(marker);
		}
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
		if (this.audioCtx != null) {
			this.draw();
		}
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
				this.updateCursor();
			} else {
				this.stopUpdateCursor();
				this.updateCursor();
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
		this.updateStartCursor();
		this.updateMarkerHover();

	}

	getStartTime(): number {
		return this.startRefTime;
	}

	moveStartTime(delta: number) {
		this.setStartTime(this.startRefTime + delta);
	}

	// Markers

	addMarker(start: number, end: number) {
		const startOffset = this.computeCursorOffset(start);
		const marker: InternalWaveformMarker = {
			start: start,
			end: end,
			offset: this.computeCursorOffset(start),
			width: this.computeCursorOffset(end) - startOffset,
			hover: false
		};
		marker.hover = this.isMarkerHover(marker);
		this.markers.push(marker);
	}

	addMarkerAtStartTime(duration: number) {
		this.addMarker(this.startRefTime, this.startRefTime + duration);
	}

	getSelectedMarkers(): WaveformMarker[] {
		return this.markers.filter(marker => marker.hover);
	}

}


export interface WaveformMarker {
	start: number,
	end: number,
}


interface InternalWaveformMarker extends WaveformMarker {
	offset: number,
	width: number,
	hover: boolean
}
