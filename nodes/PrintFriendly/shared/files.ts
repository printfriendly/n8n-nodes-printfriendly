import type { IDataObject } from 'n8n-workflow';

export type FileOutput = 'pdf' | 'docx';

const MIME_TYPES: Record<FileOutput, string> = {
	pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface FileResult {
	fileUrl: string;
	output: FileOutput;
	title?: string;
}

function isRecord(value: unknown): value is IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mimeTypeFor(output: FileOutput): string {
	return MIME_TYPES[output];
}

/**
 * Finds the downloadable file in a PrintFriendly answer.
 *
 * A synchronous `pdf` or `docx` conversion carries `file_url` at the top level. A job read from
 * GET /v2/jobs/{id} carries the same object under `result`, and only once it has succeeded.
 * Anything else (inline outputs, a job still running, an async 202) has no file and returns
 * undefined.
 */
export function findFileResult(json: unknown): FileResult | undefined {
	if (!isRecord(json)) return undefined;
	const source = isRecord(json.result) ? json.result : json;

	const fileUrl = source.file_url;
	const output = source.output;
	if (typeof fileUrl !== 'string' || fileUrl === '') return undefined;
	if (output !== 'pdf' && output !== 'docx') return undefined;

	const document = isRecord(source.document) ? source.document : undefined;
	const title = document && typeof document.title === 'string' ? document.title : undefined;

	return { fileUrl, output, title };
}

/** Lower-case words joined with dashes, safe in a file name on any system. */
export function slugify(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '');
}

/**
 * The name for the downloaded file. A name the user typed wins, and gets the right extension
 * if it has none. Otherwise the document title is used, then a generic name.
 */
export function buildFileName(result: FileResult, requested?: string): string {
	const extension = `.${result.output}`;
	const typed = typeof requested === 'string' ? requested.trim() : '';
	if (typed !== '') {
		return typed.toLowerCase().endsWith(extension) ? typed : `${typed}${extension}`;
	}
	const slug = result.title ? slugify(result.title) : '';
	return `${slug !== '' ? slug : 'document'}${extension}`;
}
