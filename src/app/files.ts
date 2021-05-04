import {FilesystemEncoding, FileReadOptions, FilesystemDirectory, FileWriteOptions} from "@capacitor/core";

export const DIRECTORY = "lig-aikuma-cp";

export function computePath(pathParts: string[]): string {
	return [DIRECTORY, ...pathParts].join("/");
}

export function getReadOptions(pathParts: string[], encoding: FilesystemEncoding): FileReadOptions {
	return {
		path: computePath(pathParts),
		directory: FilesystemDirectory.Documents,
		encoding: encoding
	};
}

export function getWriteOptions(pathParts: string[], encoding: FilesystemEncoding, data: string, recursive: boolean = true): FileWriteOptions {
	return {
		path: computePath(pathParts),
		directory: FilesystemDirectory.Documents,
		encoding: encoding,
		data: data,
		recursive: recursive
	};
}
