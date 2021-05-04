export function base64ToBuffer(base64: string): ArrayBuffer {
  const chars = atob(base64);
  const array = new Uint8Array(chars.length);
  for (let i = 0; i < chars.length; ++i) {
    array[i] = chars.charCodeAt(i);
  }
  return array.buffer;
}

export function base64ToBlob(base64: string, options?: BlobPropertyBag): Blob {
  return new Blob([base64ToBuffer(base64)], options);
}
