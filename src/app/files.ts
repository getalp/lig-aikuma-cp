import {Directory} from "@capacitor/filesystem";

export const DIRECTORY = "lig-aikuma-cp";
export const ROOT = Directory.Documents;

export function computePath(pathParts: string[]): string {
	return [DIRECTORY, ...pathParts].join("/");
}

export interface CommonOptions {
	path: string;
	directory: Directory;
}

export function getCommonOptions(pathParts: string | string[]): CommonOptions {
	return {
		path: typeof pathParts === "string" ? pathParts : computePath(pathParts),
		directory: ROOT
	}
}
