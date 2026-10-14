import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type {
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	JsonObject,
} from 'n8n-workflow';
import {
	buildConvertBody,
	buildJobPath,
	InputValidationError,
	type ConvertInput,
	type ConvertOptions,
	type OutputFormat,
	type SourceType,
} from './convert';
import { describeApiError } from './errors';
import { buildFileName, findFileResult, mimeTypeFor } from './files';

/*
 * The node is declarative: the operations in `resources/document` name these functions in
 * `routing.send.preSend` and `routing.output.postReceive`, and n8n does the HTTP call between
 * them. Everything that turns parameters into a request, or a response into items, lives here
 * so it can be tested (and run against the live API) without an n8n instance.
 */

function operationError(context: IExecuteSingleFunctions, error: unknown): NodeOperationError {
	const itemIndex = context.getItemIndex();
	if (error instanceof InputValidationError) {
		return new NodeOperationError(context.getNode(), error.message, {
			description: error.description,
			itemIndex,
		});
	}
	return new NodeOperationError(context.getNode(), error as Error, { itemIndex });
}

function readConvertInput(context: IExecuteSingleFunctions): ConvertInput {
	const sourceType = context.getNodeParameter('sourceType') as SourceType;
	return {
		sourceType,
		source: context.getNodeParameter(sourceType) as string,
		output: context.getNodeParameter('output') as OutputFormat,
		options: context.getNodeParameter('options', {}) as ConvertOptions,
	};
}

function readPageInput(context: IExecuteSingleFunctions): ConvertInput {
	const options = context.getNodeParameter('readOptions', {}) as ConvertOptions;
	return {
		sourceType: 'url',
		source: context.getNodeParameter('pageUrl') as string,
		output: context.getNodeParameter('readOutput') as OutputFormat,
		options: { includeLinks: options.includeLinks },
	};
}

/** preSend for Convert and Read Page: fills in the JSON body of POST /v2/convert. */
export async function prepareConvertRequest(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const operation = this.getNodeParameter('operation') as string;
	try {
		const input = operation === 'readPage' ? readPageInput(this) : readConvertInput(this);
		requestOptions.body = buildConvertBody(input);
	} catch (error) {
		throw operationError(this, error);
	}
	return requestOptions;
}

/** preSend for Get Job: puts the job ID in the path of GET /v2/jobs/{id}. */
export async function prepareJobRequest(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	try {
		requestOptions.url = buildJobPath(this.getNodeParameter('jobId') as string);
	} catch (error) {
		throw operationError(this, error);
	}
	// A GET carries no body.
	delete requestOptions.body;
	return requestOptions;
}

/**
 * postReceive for every operation. The requests set `ignoreHttpStatusErrors`, so a 4xx or 5xx
 * answer arrives here as a response instead of n8n's generic HTTP failure, and becomes a
 * NodeApiError that names the API's code and says what to do about it.
 */
export async function handleApiResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const itemIndex = this.getItemIndex();

	if (response.statusCode >= 400) {
		const info = describeApiError(response.statusCode, response.body, response.headers);
		const errorResponse: JsonObject =
			typeof response.body === 'object' && response.body !== null && !Array.isArray(response.body)
				? (response.body as JsonObject)
				: { message: info.message };
		throw new NodeApiError(this.getNode(), errorResponse, {
			message: info.message,
			description: info.description,
			httpCode: info.httpCode,
			itemIndex,
		});
	}

	return items.map((item) => ({ ...item, pairedItem: { item: itemIndex } }));
}

/**
 * postReceive for Convert and Get Job. When 'Download File' is on and the answer carries a
 * `file_url`, fetches the file and attaches it to the item as binary data. The link is public,
 * so the request is sent without the API key.
 */
export async function attachFileIfRequested(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	if (this.getNodeParameter('downloadFile', false) !== true) return items;

	const requestedName = this.getNodeParameter('fileName', '') as string;
	const field = (this.getNodeParameter('binaryPropertyName', 'data') as string) || 'data';

	const result: INodeExecutionData[] = [];
	for (const item of items) {
		const file = findFileResult(item.json);
		if (!file) {
			// Nothing to download: an async conversion that is still queued, or an inline output.
			result.push(item);
			continue;
		}

		let content: Buffer;
		try {
			const body = await this.helpers.httpRequest({
				method: 'GET',
				url: file.fileUrl,
				encoding: 'arraybuffer',
				json: false,
			});
			content = Buffer.from(body as ArrayBuffer);
		} catch (error) {
			throw new NodeApiError(this.getNode(), error as JsonObject, {
				message: 'The converted file could not be downloaded',
				description:
					'PrintFriendly file links work for 48 hours. If the link has expired, run the conversion again.',
				itemIndex: this.getItemIndex(),
			});
		}

		const binary = await this.helpers.prepareBinaryData(
			content,
			buildFileName(file, requestedName),
			mimeTypeFor(file.output),
		);
		result.push({ ...item, binary: { ...item.binary, [field]: binary } });
	}
	return result;
}
