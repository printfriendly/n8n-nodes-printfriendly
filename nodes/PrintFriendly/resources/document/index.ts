import type { INodeProperties } from 'n8n-workflow';
import {
	attachFileIfRequested,
	handleApiResponse,
	prepareConvertRequest,
	prepareJobRequest,
} from '../../shared/hooks';
import { documentConvertDescription } from './convert';
import { documentGetJobDescription } from './getJob';
import { documentReadPageDescription } from './readPage';

const showOnlyForDocuments = {
	resource: ['document'],
};

export const documentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForDocuments },
		options: [
			{
				name: 'Convert',
				value: 'convert',
				action: 'Convert a URL, HTML or markdown',
				description:
					'Turn a URL, HTML or Markdown into a PDF, Word file, Markdown, JSON, HTML or plain text',
				routing: {
					request: { method: 'POST', url: '/v2/convert', ignoreHttpStatusErrors: true },
					send: { preSend: [prepareConvertRequest] },
					output: { postReceive: [handleApiResponse, attachFileIfRequested] },
				},
			},
			{
				name: 'Get Job',
				value: 'getJob',
				action: 'Get an asynchronous conversion job',
				description: 'Read the status and result of a conversion that was run asynchronously',
				routing: {
					request: { method: 'GET', url: '/v2/jobs', ignoreHttpStatusErrors: true },
					send: { preSend: [prepareJobRequest] },
					output: { postReceive: [handleApiResponse, attachFileIfRequested] },
				},
			},
			{
				name: 'Read Page',
				value: 'readPage',
				action: 'Read a web page as markdown or JSON',
				description: 'Get the article of a web page as clean Markdown or as JSON',
				routing: {
					request: { method: 'POST', url: '/v2/convert', ignoreHttpStatusErrors: true },
					send: { preSend: [prepareConvertRequest] },
					output: { postReceive: [handleApiResponse] },
				},
			},
		],
		default: 'convert',
	},
	...documentConvertDescription,
	...documentReadPageDescription,
	...documentGetJobDescription,
];
