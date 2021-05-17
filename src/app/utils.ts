export function base64ToBuffer(base64: string): ArrayBuffer {
  const chars = atob(base64);
  const array = new Uint8Array(chars.length);
  for (let i = 0; i < chars.length; ++i) {
    array[i] = chars.charCodeAt(i);
  }
  return array.buffer;
}

export function formatTwoDigit(num: number): string {
	return (num < 10 ? "0" : "") + num.toString();
}

export function formatDuration(dur: number): string {

	const hours = Math.floor(dur / 3600);
	dur -= hours * 3600;

	const minutes = Math.floor(dur / 60);
	dur -= minutes * 60;

	let str = "";
	if (hours != 0) str += hours + "h";
	if (minutes != 0) str += minutes + "m";
	if (dur > 0) str += Math.floor(dur) + "s";
	return str;

}
