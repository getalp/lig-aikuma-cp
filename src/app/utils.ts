export function base64ToBuffer(base64: string): ArrayBuffer {
  const chars = atob(base64);
  const array = new Uint8Array(chars.length);
  for (let i = 0; i < chars.length; ++i) {
    array[i] = chars.charCodeAt(i);
  }
  return array.buffer;
}

export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result.toString().split(",")[1]);
		reader.onerror = err => reject(err);
		reader.readAsDataURL(blob);
	})
}

export function formatTwoDigit(num: number): string {
	return (num < 10 ? "0" : "") + num.toString();
}

export function formatDuration(dur: number, precision: number = 0): string {

	const hours = Math.floor(dur / 3600);
	dur -= hours * 3600;

	const minutes = Math.floor(dur / 60);
	dur -= minutes * 60;

	let str = "";
	if (hours != 0) str += hours + "h";
	if (minutes != 0) str += minutes + "m";
	if (precision != 0) {
		str += dur.toFixed(precision) + "s";
	} else if (dur > 0) {
		str += Math.floor(dur) + "s";
	}
	return str;

}

export function getNullablePropertyOrDefault<E, K extends keyof E>(obj: E, name: K, def: E[K]): E[K] {
	return obj == null ? def : obj[name];
}
