import {FilesystemDirectory} from "@capacitor/core";

export const DIRECTORY = "lig-aikuma-cp";
export const ROOT = FilesystemDirectory.Documents;

export function computePath(pathParts: string[]): string {
	return [DIRECTORY, ...pathParts].join("/");
}

export interface CommonOptions {
	path: string;
	directory: FilesystemDirectory;
}

export function getCommonOptions(pathParts: string | string[]): CommonOptions {
	return {
		path: typeof pathParts === "string" ? pathParts : computePath(pathParts),
		directory: ROOT
	}
}
