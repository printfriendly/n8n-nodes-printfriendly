import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeApiError } from '../dist/nodes/PrintFriendly/shared/errors.js';

test('GenerationError body: code, summary and the API wording', () => {
	const info = describeApiError(
		422,
		{
			status: 'failed',
			message: 'Print technology timed-out while trying to connect to this page',
			error: {
				code: 'fetch_failed',
				message: 'Print technology timed-out while trying to connect to this page',
				retryable: true,
			},
		},
		{ 'x-request-id': 'req_123' },
	);
	assert.equal(info.code, 'fetch_failed');
	assert.equal(info.httpCode, '422');
	assert.equal(info.message, 'PrintFriendly could not load the page (fetch_failed)');
	assert.match(info.description, /Sending the same request again can work/);
	assert.match(info.description, /Print technology timed-out/);
	assert.match(info.description, /req_123/);
});

test('ValidationError body: field problems are listed', () => {
	const info = describeApiError(400, {
		status: 'failed',
		error: {
			type: 'parameters-validation',
			errors: { base: ['You must provide one of url, html or markdown'] },
			message: 'You must provide one of url, html or markdown',
			code: 'invalid_parameters',
			retryable: false,
		},
	});
	assert.equal(info.code, 'invalid_parameters');
	assert.match(info.description, /base: You must provide one of url, html or markdown/);
});

test('invalid_api_key points at the key page', () => {
	const info = describeApiError(401, {
		status: 'failed',
		error: { code: 'invalid_api_key', message: 'x', retryable: false },
	});
	assert.match(info.message, /invalid_api_key/);
	assert.match(info.description, /printfriendly\.com\/me\/api-key/);
});

test('quota_exceeded carries the upgrade link; rate_limited the wait', () => {
	const quota = describeApiError(402, {
		status: 'failed',
		message: 'Your free plan includes 100 documents a month. Upgrade for more.',
		error: {
			code: 'quota_exceeded',
			message: 'm',
			upgrade_url: 'https://www.printfriendly.com/api#pricing',
			retryable: false,
		},
	});
	assert.match(quota.description, /api#pricing/);

	const limited = describeApiError(
		429,
		{
			status: 'failed',
			message: 'm',
			error: { code: 'rate_limited', message: 'm', retryable: true, retry_after_seconds: 12 },
		},
		{ 'Retry-After': '12' },
	);
	assert.match(limited.description, /12 seconds/);
});

test('a firewall page that is not JSON is called out', () => {
	const info = describeApiError(
		403,
		'<!DOCTYPE html><html><title>Attention Required! | Cloudflare</title>',
		{},
	);
	assert.equal(info.code, undefined);
	assert.equal(info.httpCode, '403');
	assert.match(info.message, /did not answer with JSON \(HTTP 403\)/);
	assert.match(info.description, /firewall/);
});

test('an unknown code or an empty body still gives a usable message', () => {
	assert.equal(
		describeApiError(500, { error: { code: 'brand_new_code', message: 'Something new' } }).message,
		'PrintFriendly answered with brand_new_code (HTTP 500)',
	);
	assert.equal(describeApiError(502, '').message, 'PrintFriendly answered with HTTP 502');
});
