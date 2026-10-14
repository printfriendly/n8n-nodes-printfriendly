import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	buildConvertBody,
	buildJobPath,
	InputValidationError,
} from '../dist/nodes/PrintFriendly/shared/convert.js';

test('url source: sends only url and output, trimmed', () => {
	const body = buildConvertBody({
		sourceType: 'url',
		source: '  https://example.com/article  ',
		output: 'markdown',
	});
	assert.deepEqual(body, { url: 'https://example.com/article', output: 'markdown' });
});

test('html and markdown sources are sent exactly as given', () => {
	const markdown = '\n# Title\n\nText  \n';
	assert.deepEqual(buildConvertBody({ sourceType: 'markdown', source: markdown, output: 'pdf' }), {
		markdown,
		output: 'pdf',
	});
	assert.deepEqual(buildConvertBody({ sourceType: 'html', source: '<p>Hi</p>', output: 'docx' }), {
		html: '<p>Hi</p>',
		output: 'docx',
	});
});

test('every option maps to the API field name', () => {
	const body = buildConvertBody({
		sourceType: 'html',
		source: '<p>Hi</p>',
		output: 'pdf',
		options: {
			title: 'Report',
			pageSize: 'a4',
			cssUrl: 'https://example.com/print.css',
			headerText: 'Acme',
			headerImageUrl: 'https://example.com/logo.png',
			language: 'pt-BR',
			direction: 'rtl',
			includeLinks: true,
			sourceUrl: 'https://example.com/post',
			runAsync: true,
			webhookUrl: 'https://example.com/hook',
		},
	});
	assert.deepEqual(body, {
		html: '<p>Hi</p>',
		output: 'pdf',
		title: 'Report',
		page_size: 'a4',
		css_url: 'https://example.com/print.css',
		header_text: 'Acme',
		header_image_url: 'https://example.com/logo.png',
		lang: 'pt-BR',
		dir: 'rtl',
		include_links: true,
		source_url: 'https://example.com/post',
		async: true,
		webhook_url: 'https://example.com/hook',
	});
});

test('unset and empty options are left out, so API defaults apply', () => {
	const body = buildConvertBody({
		sourceType: 'url',
		source: 'https://example.com/a',
		output: 'pdf',
		options: { title: '', headerText: '   ', runAsync: false },
	});
	assert.deepEqual(body, { url: 'https://example.com/a', output: 'pdf' });
});

test('include_links false is sent when the user set it', () => {
	const body = buildConvertBody({
		sourceType: 'url',
		source: 'https://example.com/a',
		output: 'text',
		options: { includeLinks: false },
	});
	assert.equal(body.include_links, false);
});

test('an empty source is rejected before any request is made', () => {
	assert.throws(
		() => buildConvertBody({ sourceType: 'url', source: '   ', output: 'pdf' }),
		(error) => error instanceof InputValidationError && error.message.includes("'URL'"),
	);
});

test('job path encodes the id and rejects an empty one', () => {
	assert.equal(
		buildJobPath(' 5b1f6a52-0c0e-4d8e-9d8f-3f0a6a7d1c21 '),
		'/v2/jobs/5b1f6a52-0c0e-4d8e-9d8f-3f0a6a7d1c21',
	);
	assert.equal(buildJobPath('a/b?c'), '/v2/jobs/a%2Fb%3Fc');
	assert.throws(() => buildJobPath(''), InputValidationError);
});
