import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
	attachFileIfRequested,
	handleApiResponse,
	prepareConvertRequest,
	prepareJobRequest,
} from '../dist/nodes/PrintFriendly/shared/hooks.js';
import { fakeContext } from './helpers.mjs';

// Load n8n-workflow the way the compiled node does (CommonJS), so error classes are the same ones.
const require = createRequire(import.meta.url);
const { NodeApiError, NodeOperationError } = require('n8n-workflow');

test('Convert builds the request body from the node parameters', async () => {
	const ctx = fakeContext({
		params: {
			operation: 'convert',
			sourceType: 'markdown',
			markdown: '# Hello',
			output: 'pdf',
			options: { pageSize: 'a4', title: 'Greeting' },
		},
	});
	const out = await prepareConvertRequest.call(ctx, { url: '/v2/convert', body: {} });
	assert.deepEqual(out.body, {
		markdown: '# Hello',
		output: 'pdf',
		page_size: 'a4',
		title: 'Greeting',
	});
});

test('Read Page is a URL conversion with its own fields', async () => {
	const ctx = fakeContext({
		params: {
			operation: 'readPage',
			pageUrl: 'https://example.com/a',
			readOutput: 'markdown',
			readOptions: { includeLinks: true },
		},
	});
	const out = await prepareConvertRequest.call(ctx, { url: '/v2/convert', body: {} });
	assert.deepEqual(out.body, {
		url: 'https://example.com/a',
		output: 'markdown',
		include_links: true,
	});
});

test('an empty source becomes a NodeOperationError that names the field', async () => {
	const ctx = fakeContext({
		params: { operation: 'convert', sourceType: 'url', url: '', output: 'pdf' },
	});
	await assert.rejects(
		prepareConvertRequest.call(ctx, { url: '/v2/convert', body: {} }),
		(error) => error instanceof NodeOperationError && error.message.includes("'URL'"),
	);
});

test('Get Job puts the id in the path and drops the body', async () => {
	const ctx = fakeContext({ params: { jobId: ' abc-123 ' } });
	const out = await prepareJobRequest.call(ctx, { url: '/v2/jobs', body: {} });
	assert.equal(out.url, '/v2/jobs/abc-123');
	assert.equal('body' in out, false);
});

test('a 2xx response passes through, linked to its input item', async () => {
	const items = [{ json: { status: 'success', output: 'markdown', content: '# x' } }];
	const out = await handleApiResponse.call(fakeContext(), items, {
		statusCode: 200,
		body: items[0].json,
		headers: {},
	});
	assert.equal(out.length, 1);
	assert.deepEqual(out[0].json, items[0].json);
	assert.deepEqual(out[0].pairedItem, { item: 0 });
});

test('a 202 (async accepted) is not an error', async () => {
	const body = { status: 'queued', job_id: 'j', status_url: 'u', expires_at: 'e' };
	const out = await handleApiResponse.call(fakeContext(), [{ json: body }], {
		statusCode: 202,
		body,
		headers: {},
	});
	assert.equal(out[0].json.job_id, 'j');
});

test('a 4xx response becomes a NodeApiError with the code in the message', async () => {
	const body = {
		status: 'failed',
		message: 'Your free plan includes 100 documents a month. Upgrade for more.',
		error: {
			code: 'quota_exceeded',
			message: 'Your free plan includes 100 documents a month. Upgrade for more.',
			retryable: false,
			upgrade_url: 'https://www.printfriendly.com/api#pricing',
		},
	};
	await assert.rejects(
		handleApiResponse.call(fakeContext(), [{ json: body }], {
			statusCode: 402,
			body,
			headers: { 'x-request-id': 'r1' },
		}),
		(error) => {
			assert.ok(error instanceof NodeApiError);
			assert.match(error.message, /quota_exceeded/);
			assert.equal(error.httpCode, '402');
			assert.match(error.description, /api#pricing/);
			assert.match(error.description, /r1/);
			return true;
		},
	);
});

test('a non-JSON 403 becomes a NodeApiError too', async () => {
	await assert.rejects(
		handleApiResponse.call(fakeContext(), [{ json: {} }], {
			statusCode: 403,
			body: '<!DOCTYPE html><html>blocked</html>',
			headers: {},
		}),
		(error) => error instanceof NodeApiError && error.httpCode === '403',
	);
});

const pdfAnswer = {
	status: 'success',
	output: 'pdf',
	file_url: 'https://storage.printfriendly.com/data-production/pdf_1.pdf',
	expires_at: '2026-10-15T12:00:00.000Z',
	size_bytes: 8,
	document: { title: 'Hello World' },
	usage: { used_this_period: 1, included: 100, plan: 'free' },
};

test('Download File attaches the PDF as binary data, without the API key', async () => {
	const ctx = fakeContext({
		params: { downloadFile: true, binaryPropertyName: 'file', fileName: '' },
		httpRequest: async () => Buffer.from('%PDF-1.4 '),
	});
	const out = await attachFileIfRequested.call(ctx, [{ json: pdfAnswer }]);
	assert.equal(ctx.calls.httpRequest.length, 1);
	const request = ctx.calls.httpRequest[0];
	assert.equal(request.url, pdfAnswer.file_url);
	assert.equal(request.encoding, 'arraybuffer');
	assert.equal(request.headers, undefined);
	assert.equal(out[0].binary.file.fileName, 'hello-world.pdf');
	assert.equal(out[0].binary.file.mimeType, 'application/pdf');
	assert.deepEqual(out[0].json, pdfAnswer);
});

test('Download File does nothing when it is off, or when there is no file', async () => {
	const off = fakeContext({ params: { downloadFile: false } });
	const items = [{ json: pdfAnswer }];
	assert.equal(await attachFileIfRequested.call(off, items), items);
	assert.equal(off.calls.httpRequest.length, 0);

	const on = fakeContext({ params: { downloadFile: true } });
	const queued = [{ json: { status: 'queued', job_id: 'j' } }];
	const out = await attachFileIfRequested.call(on, queued);
	assert.deepEqual(out, queued);
	assert.equal(on.calls.httpRequest.length, 0);
});

test('Download File works on a finished job and defaults the field to data', async () => {
	const ctx = fakeContext({
		params: { downloadFile: true, fileName: 'invoice' },
		httpRequest: async () => Buffer.from('PK'),
	});
	const job = { status: 'succeeded', job_id: 'j', result: { ...pdfAnswer, output: 'docx' } };
	const out = await attachFileIfRequested.call(ctx, [{ json: job }]);
	assert.equal(out[0].binary.data.fileName, 'invoice.docx');
	assert.match(out[0].binary.data.mimeType, /wordprocessingml/);
});

test('an expired file link becomes a NodeApiError with a hint', async () => {
	const ctx = fakeContext({
		params: { downloadFile: true },
		httpRequest: async () => {
			throw Object.assign(new Error('Request failed with status code 404'), { httpCode: '404' });
		},
	});
	await assert.rejects(
		attachFileIfRequested.call(ctx, [{ json: pdfAnswer }]),
		(error) =>
			error instanceof NodeApiError &&
			/could not be downloaded/.test(error.message) &&
			/48 hours/.test(error.description),
	);
});
