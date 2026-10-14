import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	buildFileName,
	findFileResult,
	mimeTypeFor,
	slugify,
} from '../dist/nodes/PrintFriendly/shared/files.js';

const sync = {
	status: 'success',
	output: 'pdf',
	file_url: 'https://storage.printfriendly.com/data-production/pdf_1.pdf',
	document: { title: 'Eclipse: A Guide!' },
};

test('finds the file in a synchronous answer and in a finished job', () => {
	assert.deepEqual(findFileResult(sync), {
		fileUrl: sync.file_url,
		output: 'pdf',
		title: 'Eclipse: A Guide!',
	});
	const job = { status: 'succeeded', job_id: 'j', result: { ...sync, output: 'docx' } };
	assert.equal(findFileResult(job)?.output, 'docx');
});

test('no file for inline outputs, a queued job or an async 202', () => {
	assert.equal(
		findFileResult({ status: 'success', output: 'markdown', content: '# x' }),
		undefined,
	);
	assert.equal(findFileResult({ status: 'queued', job_id: 'j', status_url: 'u' }), undefined);
	assert.equal(findFileResult({ status: 'processing', job_id: 'j' }), undefined);
	assert.equal(findFileResult(null), undefined);
});

test('file names: typed name wins, then title, then a generic name', () => {
	const file = findFileResult(sync);
	assert.equal(buildFileName(file), 'eclipse-a-guide.pdf');
	assert.equal(buildFileName(file, 'Q3 report'), 'Q3 report.pdf');
	assert.equal(buildFileName(file, 'report.PDF'), 'report.PDF');
	assert.equal(buildFileName({ fileUrl: 'u', output: 'docx' }), 'document.docx');
	assert.equal(buildFileName({ fileUrl: 'u', output: 'pdf', title: '???' }), 'document.pdf');
});

test('slugify strips accents and symbols and stays short', () => {
	assert.equal(slugify('Café Münster: 10 Tips'), 'cafe-munster-10-tips');
	assert.ok(slugify('x'.repeat(200)).length <= 80);
});

test('mime types', () => {
	assert.equal(mimeTypeFor('pdf'), 'application/pdf');
	assert.equal(
		mimeTypeFor('docx'),
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	);
});
