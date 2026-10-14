// Exercises the node's routing configuration the way n8n reads it: the operations, where each
// one sends its request, which hooks run, and that the credential is wired up correctly.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrintFriendly } = require('../dist/nodes/PrintFriendly/PrintFriendly.node.js');
const { PrintFriendlyApi } = require('../dist/credentials/PrintFriendlyApi.credentials.js');
const pkg = require('../package.json');

const description = new PrintFriendly().description;
const operations = description.properties.find((p) => p.name === 'operation').options;
const byValue = Object.fromEntries(operations.map((o) => [o.value, o]));

test('package.json registers the node and credential that the build produces', () => {
	assert.ok(pkg.keywords.includes('n8n-community-node-package'));
	assert.deepEqual(pkg.n8n.nodes, ['dist/nodes/PrintFriendly/PrintFriendly.node.js']);
	assert.deepEqual(pkg.n8n.credentials, ['dist/credentials/PrintFriendlyApi.credentials.js']);
	assert.equal(pkg.dependencies, undefined, 'a verified node has no runtime dependencies');
});

test('the node uses the declarative style: routing, no execute()', () => {
	assert.equal(typeof new PrintFriendly().execute, 'undefined');
	assert.ok(description.requestDefaults.baseURL.includes('https://api.printfriendly.com'));
	assert.equal(description.credentials[0].name, new PrintFriendlyApi().name);
});

test('three operations send to the right endpoints', () => {
	assert.deepEqual(Object.keys(byValue).sort(), ['convert', 'getJob', 'readPage']);
	assert.deepEqual(
		[byValue.convert, byValue.readPage].map((o) => [
			o.routing.request.method,
			o.routing.request.url,
		]),
		[
			['POST', '/v2/convert'],
			['POST', '/v2/convert'],
		],
	);
	assert.deepEqual(
		[byValue.getJob.routing.request.method, byValue.getJob.routing.request.url],
		['GET', '/v2/jobs'],
	);
});

test('every operation turns API failures into n8n errors instead of HTTP exceptions', () => {
	for (const op of operations) {
		assert.equal(op.routing.request.ignoreHttpStatusErrors, true, op.value);
		assert.equal(op.routing.output.postReceive[0].name, 'handleApiResponse', op.value);
	}
	assert.deepEqual(
		byValue.convert.routing.output.postReceive.map((f) => f.name),
		['handleApiResponse', 'attachFileIfRequested'],
	);
	assert.deepEqual(
		byValue.readPage.routing.output.postReceive.map((f) => f.name),
		['handleApiResponse'],
	);
});

test('Convert exposes every option the API takes, and async', () => {
	const options = description.properties.find((p) => p.name === 'options');
	const names = options.options.map((o) => o.name).sort();
	assert.deepEqual(names, [
		'cssUrl',
		'direction',
		'headerImageUrl',
		'headerText',
		'includeLinks',
		'language',
		'pageSize',
		'runAsync',
		'sourceUrl',
		'title',
		'webhookUrl',
	]);
	const output = description.properties.find((p) => p.name === 'output');
	assert.deepEqual(output.options.map((o) => o.value).sort(), [
		'docx',
		'html',
		'json',
		'markdown',
		'pdf',
		'text',
	]);
});

test('Download File is offered for pdf and docx output, and for Get Job only', () => {
	const downloads = description.properties.filter((p) => p.name === 'downloadFile');
	assert.equal(downloads.length, 2);
	const forConvert = downloads.find((p) => p.displayOptions.show.operation[0] === 'convert');
	assert.deepEqual(forConvert.displayOptions.show.output, ['pdf', 'docx']);
});

test('credential: Bearer header, password field, and a test that costs no document', () => {
	const credential = new PrintFriendlyApi();
	assert.equal(
		credential.authenticate.properties.headers.Authorization,
		'=Bearer {{$credentials.apiKey}}',
	);
	const apiKey = credential.properties.find((p) => p.name === 'apiKey');
	assert.equal(apiKey.typeOptions.password, true);
	assert.equal(credential.test.request.method, 'GET');
	assert.match(credential.test.request.url, /^\/v2\/jobs\//);
	assert.equal(credential.test.request.ignoreHttpStatusErrors.except.includes(404), false);
	assert.equal(credential.test.request.ignoreHttpStatusErrors.except.includes(401), true);
});
