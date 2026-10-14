#!/usr/bin/env node
/*
 * Live check against the real PrintFriendly API, without an n8n instance.
 *
 * It stands in for n8n's routing engine: for each operation it reads the routing config from the
 * built node, runs the node's own preSend hook to build the request, sends it, then runs the
 * node's own postReceive hooks on the answer. So the request builder, the error mapping and the
 * file download are the code that ships, not a copy of it.
 *
 *   npm run build
 *   PRINTFRIENDLY_API_KEY=... node scripts/live-check.mjs [options]
 *
 * Options
 *   --steps <list>      Comma-separated. Default: probe,read,convert,errors
 *                         probe    key check as the credential test does it (free)
 *                         read     Read Page, URL to Markdown (1 document)
 *                         convert  Convert, Markdown to PDF with Download File (1 document)
 *                         errors   three calls the API refuses, to see the error mapping (free)
 *                         download Download File on an existing link, needs --file-url (free)
 *   --file-url <url>    A file_url from an earlier conversion, for the download step
 *   --out <dir>         Where downloaded files are saved. Default: live-check-output
 *   --base-url <url>    Default: https://api.printfriendly.com
 *
 * The default steps use two documents. The key is read from the environment and never printed.
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { PrintFriendly } = require('../dist/nodes/PrintFriendly/PrintFriendly.node.js');
const { attachFileIfRequested } = require('../dist/nodes/PrintFriendly/shared/hooks.js');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const index = args.indexOf(name);
	return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const apiKey = process.env.PRINTFRIENDLY_API_KEY;
if (!apiKey) {
	console.error('Set PRINTFRIENDLY_API_KEY first.');
	process.exit(2);
}
const baseUrl = flag('--base-url', 'https://api.printfriendly.com').replace(/\/+$/, '');
const outDir = path.resolve(flag('--out', 'live-check-output'));
const steps = new Set(flag('--steps', 'probe,read,convert,errors').split(','));

const description = new PrintFriendly().description;
const operations = Object.fromEntries(
	description.properties.find((p) => p.name === 'operation').options.map((o) => [o.value, o]),
);

/** The part of n8n's `helpers.httpRequest` the node relies on, on top of fetch. */
async function httpRequest(options) {
	// A file link is absolute and has no base URL; API calls give a path and a baseURL.
	const url = new URL(options.url, options.baseURL ? `${options.baseURL}/` : undefined);
	for (const [key, value] of Object.entries(options.qs ?? {}))
		url.searchParams.set(key, String(value));
	const hasBody = options.body && Object.keys(options.body).length > 0 && options.method !== 'GET';

	// n8n's helper adds this User-Agent when a request has none; the shim does the same so the
	// API sees what it would see from a real n8n.
	const headers = { 'User-Agent': 'n8n', ...options.headers };

	const response = await fetch(url, {
		method: options.method ?? 'GET',
		headers,
		body: hasBody ? JSON.stringify(options.body) : undefined,
		redirect: 'follow',
	});

	const responseHeaders = Object.fromEntries(response.headers.entries());
	let body;
	if (options.encoding === 'arraybuffer') {
		body = Buffer.from(await response.arrayBuffer());
	} else {
		const text = await response.text();
		body =
			(responseHeaders['content-type'] ?? '').includes('json') && text !== ''
				? JSON.parse(text)
				: text;
	}

	if (!response.ok && !options.ignoreHttpStatusErrors) {
		throw Object.assign(new Error(`Request failed with status code ${response.status}`), {
			httpCode: String(response.status),
		});
	}
	return options.returnFullResponse
		? {
				body,
				headers: responseHeaders,
				statusCode: response.status,
				statusMessage: response.statusText,
			}
		: body;
}

function contextFor(params) {
	return {
		getNodeParameter: (name, fallback) => (name in params ? params[name] : fallback),
		getNode: () => ({
			name: 'PrintFriendly',
			type: 'n8n-nodes-printfriendly.printFriendly',
			typeVersion: 1,
		}),
		getItemIndex: () => 0,
		helpers: {
			httpRequest,
			// n8n stores binary data as base64 plus metadata.
			prepareBinaryData: async (buffer, fileName, mimeType) => ({
				data: buffer.toString('base64'),
				fileName,
				mimeType,
				fileSize: `${Math.ceil(buffer.length / 1024)} kB`,
			}),
		},
	};
}

/** What n8n's RoutingNode does for one item of one operation. */
async function runOperation(operation, params, key = apiKey) {
	const { routing } = operations[operation];
	const context = contextFor({ operation, resource: 'document', ...params });

	let options = {
		baseURL: baseUrl,
		url: routing.request.url,
		method: routing.request.method,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${key}`,
		},
		qs: {},
		body: {},
		ignoreHttpStatusErrors: routing.request.ignoreHttpStatusErrors,
		returnFullResponse: true,
	};
	for (const preSend of routing.send?.preSend ?? []) options = await preSend.call(context, options);

	const response = await httpRequest(options);
	let items = [{ json: response.body }];
	for (const postReceive of routing.output?.postReceive ?? []) {
		items = await postReceive.call(context, items, response);
	}
	return { items, response };
}

const results = [];
function failure(name, started, error) {
	return {
		step: name,
		ok: false,
		ms: Date.now() - started,
		name: error.name,
		message: error.message,
		description: error.description,
		httpCode: error.httpCode,
	};
}

async function step(name, fn) {
	const started = Date.now();
	try {
		const detail = await fn();
		results.push({ step: name, ok: true, ms: Date.now() - started, ...detail });
	} catch (error) {
		results.push(failure(name, started, error));
	}
}

/** Runs something the API must refuse, and records the n8n error it turns into. */
async function expectRefusal(name, fn, expectedCode) {
	const started = Date.now();
	try {
		await fn();
		results.push({ step: name, ok: false, ms: Date.now() - started, message: 'was not refused' });
	} catch (error) {
		const entry = failure(name, started, error);
		entry.ok = typeof error.message === 'string' && error.message.includes(`(${expectedCode})`);
		results.push(entry);
	}
}

async function describeFile(item) {
	const binary = item.binary?.data;
	if (!binary) throw new Error('no binary data on the item');
	const buffer = Buffer.from(binary.data, 'base64');
	await mkdir(outDir, { recursive: true });
	const file = path.join(outDir, binary.fileName);
	await writeFile(file, buffer);
	return {
		fileName: binary.fileName,
		mimeType: binary.mimeType,
		bytes: buffer.length,
		apiSizeBytes: item.json.size_bytes,
		startsWithPdfMagic: buffer.subarray(0, 5).toString('latin1') === '%PDF-',
		savedTo: file,
		usage: item.json.usage,
	};
}

// Key check, as the credential test does it. Free: no document is used.
if (steps.has('probe')) {
	await step('credential test (GET /v2/jobs/<unused id>, 404 means key accepted)', async () => {
		const response = await httpRequest({
			baseURL: baseUrl,
			url: '/v2/jobs/00000000-0000-4000-8000-000000000000',
			method: 'GET',
			headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
			ignoreHttpStatusErrors: true,
			returnFullResponse: true,
		});
		const accepted = response.statusCode === 404 && response.body?.error?.code === 'job_not_found';
		if (!accepted) {
			throw Object.assign(new Error(`key not verified: HTTP ${response.statusCode}`), {
				httpCode: String(response.statusCode),
			});
		}
		return { httpStatus: response.statusCode, code: response.body.error.code };
	});
}

// Read Page: URL to Markdown. One document.
if (steps.has('read')) {
	await step('Read Page: URL to Markdown', async () => {
		const { items } = await runOperation('readPage', {
			pageUrl: 'https://en.wikipedia.org/wiki/Pangram',
			readOutput: 'markdown',
			readOptions: {},
		});
		const json = items[0].json;
		return {
			output: json.output,
			title: json.document?.title,
			wordCount: json.document?.word_count,
			contentChars: json.content?.length,
			contentStart: json.content?.slice(0, 80),
			usage: json.usage,
		};
	});
}

// Convert: Markdown to PDF, downloaded as binary data. One document.
if (steps.has('convert')) {
	await step('Convert: Markdown to PDF with Download File', async () => {
		const { items } = await runOperation('convert', {
			sourceType: 'markdown',
			markdown:
				'# PrintFriendly n8n live check\n\nThis PDF was made by the n8n-nodes-printfriendly request code.\n\n- one\n- two\n',
			output: 'pdf',
			options: { title: 'n8n live check', pageSize: 'a4' },
			downloadFile: true,
			binaryPropertyName: 'data',
			fileName: '',
		});
		return await describeFile(items[0]);
	});
}

// Calls the API refuses. Failed calls are free, so these cost no document.
if (steps.has('errors')) {
	await expectRefusal(
		'error mapping: wrong API key',
		() =>
			runOperation(
				'readPage',
				{ pageUrl: 'https://example.com/a', readOutput: 'markdown' },
				'not-a-real-key',
			),
		'invalid_api_key',
	);
	await expectRefusal(
		'error mapping: Get Job with an ID that does not exist',
		() => runOperation('getJob', { jobId: '00000000-0000-4000-8000-000000000001' }),
		'job_not_found',
	);
	await expectRefusal(
		'error mapping: an output the API does not know',
		() => runOperation('readPage', { pageUrl: 'https://example.com/a', readOutput: 'bogus' }),
		'invalid_parameters',
	);
}

// Download File on a link that already exists. Free.
if (steps.has('download')) {
	const fileUrl = flag('--file-url');
	await step('Download File on an existing file_url', async () => {
		if (!fileUrl) throw new Error('pass --file-url <a file_url from an earlier conversion>');
		const context = contextFor({ downloadFile: true, binaryPropertyName: 'data', fileName: '' });
		const items = await attachFileIfRequested.call(context, [
			{
				json: {
					status: 'success',
					output: 'pdf',
					file_url: fileUrl,
					document: { title: 'n8n live check' },
				},
			},
		]);
		return await describeFile(items[0]);
	});
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
