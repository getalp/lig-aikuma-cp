import {FilesystemEncoding, FileReadOptions, FilesystemDirectory, FileWriteOptions} from "@capacitor/core";

export const DIRECTORY = "lig-aikuma-cp";

export function computePath(pathParts: string[]): string {
	return [DIRECTORY, ...pathParts].join("/");
}

export function getReadOptions(pathParts: string[], encoding: FilesystemEncoding): FileReadOptions {
	return {
		path: this.computePath(pathParts),
		directory: FilesystemDirectory.ExternalStorage,
		encoding: encoding
	};
}

export function getWriteOptions(pathParts: string[], encoding: FilesystemEncoding, data: string, recursive: boolean = true): FileWriteOptions {
	return {
		path: this.computePath(pathParts),
		directory: FilesystemDirectory.ExternalStorage,
		encoding: encoding,
		data: data,
		recursive: recursive
	};
}
