import type { IDataObject } from 'n8n-workflow';

/** The production API host. A credential field can override it for staging or tests. */
export const DEFAULT_BASE_URL = 'https://api.printfriendly.com';

export type SourceType = 'url' | 'html' | 'markdown';

export type OutputFormat = 'pdf' | 'docx' | 'markdown' | 'html' | 'text' | 'json';

export interface ConvertOptions {
	title?: string;
	pageSize?: 'letter' | 'a4';
	cssUrl?: string;
	headerText?: string;
	headerImageUrl?: string;
	language?: string;
	direction?: 'ltr' | 'rtl';
	includeLinks?: boolean;
	sourceUrl?: string;
	runAsync?: boolean;
	webhookUrl?: string;
}

export interface ConvertInput {
	sourceType: SourceType;
	source: string;
	output: OutputFormat;
	options?: ConvertOptions;
}

/**
 * Raised for input the node can reject before calling the API. The hooks turn it into a
 * NodeOperationError, so this module stays free of n8n runtime imports.
 */
export class InputValidationError extends Error {
	readonly description: string;

	constructor(message: string, description: string) {
		super(message);
		this.name = 'InputValidationError';
		this.description = description;
	}
}

const SOURCE_LABELS: Record<SourceType, string> = {
	url: 'URL',
	html: 'HTML',
	markdown: 'Markdown',
};

function setIfPresent(body: IDataObject, key: string, value: string | undefined): void {
	if (typeof value === 'string' && value.trim() !== '') {
		body[key] = value.trim();
	}
}

/**
 * Builds the JSON body for POST /v2/convert from the node's parameters.
 *
 * Exactly one of `url`, `html` or `markdown` is sent. Optional fields are left out unless the
 * user set them, so the API's own defaults apply.
 */
export function buildConvertBody(input: ConvertInput): IDataObject {
	const { sourceType, output } = input;
	const options = input.options ?? {};
	const source = typeof input.source === 'string' ? input.source : '';

	if (source.trim() === '') {
		throw new InputValidationError(
			`The '${SOURCE_LABELS[sourceType]}' field is empty`,
			`Enter the ${SOURCE_LABELS[sourceType]} to convert, or map it from a previous node.`,
		);
	}

	const body: IDataObject = {
		// HTML and Markdown are sent exactly as given; only a URL is trimmed.
		[sourceType]: sourceType === 'url' ? source.trim() : source,
		output,
	};

	setIfPresent(body, 'title', options.title);
	setIfPresent(body, 'page_size', options.pageSize);
	setIfPresent(body, 'css_url', options.cssUrl);
	setIfPresent(body, 'header_text', options.headerText);
	setIfPresent(body, 'header_image_url', options.headerImageUrl);
	setIfPresent(body, 'lang', options.language);
	setIfPresent(body, 'dir', options.direction);
	setIfPresent(body, 'source_url', options.sourceUrl);
	setIfPresent(body, 'webhook_url', options.webhookUrl);

	if (typeof options.includeLinks === 'boolean') {
		body.include_links = options.includeLinks;
	}
	if (options.runAsync === true) {
		body.async = true;
	}

	return body;
}

/** The path for GET /v2/jobs/{id}, with the id made safe for a URL. */
export function buildJobPath(jobId: string): string {
	const id = typeof jobId === 'string' ? jobId.trim() : '';
	if (id === '') {
		throw new InputValidationError(
			"The 'Job ID' field is empty",
			"Enter the job ID that Convert returned when 'Run Asynchronously' was on.",
		);
	}
	return `/v2/jobs/${encodeURIComponent(id)}`;
}
