import {
	FilesystemEncoding,
	FileReadOptions,
	FilesystemDirectory,
	FileWriteOptions,
	StatOptions,
	MkdirOptions
} from "@capacitor/core";

export const DIRECTORY = "lig-aikuma-cp";
export const ROOT = FilesystemDirectory.Documents;

export function computePath(pathParts: string[]): string {
	return [DIRECTORY, ...pathParts].join("/");
}

export function getReadOptions(pathParts: string[], encoding: FilesystemEncoding): FileReadOptions {
	return {
		path: computePath(pathParts),
		directory: ROOT,
		encoding: encoding
	};
}

export function getWriteOptions(pathParts: string[], encoding: FilesystemEncoding, data: string, recursive: boolean = true): FileWriteOptions {
	return {
		path: computePath(pathParts),
		directory: ROOT,
		encoding: encoding,
		data: data,
		recursive: recursive
	};
}

export function getStatOptions(pathParts: string[]): StatOptions {
	return {
		path: computePath(pathParts),
		directory: ROOT
	};
}

export function getMkdirOptions(pathParts: string[], recursive: boolean = true): MkdirOptions {
	return {
		path: computePath(pathParts),
		directory: ROOT,
		recursive: recursive
	};
}
