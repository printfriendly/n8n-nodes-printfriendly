import type { INodeProperties } from 'n8n-workflow';
import { downloadFileFields } from '../../shared/descriptions';

const showOnlyForConvert = {
	resource: ['document'],
	operation: ['convert'],
};

export const documentConvertDescription: INodeProperties[] = [
	{
		displayName: 'Source Type',
		name: 'sourceType',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'HTML', value: 'html', description: 'Convert HTML you already have' },
			{ name: 'Markdown', value: 'markdown', description: 'Convert GitHub-flavoured Markdown' },
			{ name: 'URL', value: 'url', description: 'Fetch a web page and convert its article' },
		],
		default: 'url',
		displayOptions: { show: showOnlyForConvert },
		description: 'What to convert',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://example.com/article',
		displayOptions: { show: { ...showOnlyForConvert, sourceType: ['url'] } },
		description:
			"The web page to convert. PrintFriendly fetches it and keeps the article. Use a link to one article, not a site's front page.",
	},
	{
		displayName: 'HTML',
		name: 'html',
		type: 'string',
		typeOptions: { rows: 6 },
		default: '',
		required: true,
		displayOptions: { show: { ...showOnlyForConvert, sourceType: ['html'] } },
		description:
			'HTML to convert, treated as the article body. Scripts and anything unsafe are removed. Up to 2 MB of markup.',
	},
	{
		displayName: 'Markdown',
		name: 'markdown',
		type: 'string',
		typeOptions: { rows: 6 },
		default: '',
		required: true,
		displayOptions: { show: { ...showOnlyForConvert, sourceType: ['markdown'] } },
		description: 'Markdown to convert, up to 1 MB',
	},
	{
		displayName: 'Output Format',
		name: 'output',
		type: 'options',
		options: [
			{ name: 'HTML', value: 'html', description: 'Returned in the content field' },
			{ name: 'JSON', value: 'json', description: 'The article in pieces, in the document field' },
			{ name: 'Markdown', value: 'markdown', description: 'Returned in the content field' },
			{ name: 'PDF', value: 'pdf', description: 'A file link that works for 48 hours' },
			{ name: 'Plain Text', value: 'text', description: 'Returned in the content field' },
			{
				name: 'Word (DOCX)',
				value: 'docx',
				description: 'A file link that works for 48 hours',
			},
		],
		default: 'pdf',
		displayOptions: { show: showOnlyForConvert },
		description: 'The format to convert to',
	},
	...downloadFileFields(
		{ ...showOnlyForConvert, output: ['pdf', 'docx'] },
		"Whether to download the file and attach it to the item as binary data. The file link in the response works for 48 hours. Not used with 'Run Asynchronously': read the finished job with Get Job instead.",
	),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showOnlyForConvert },
		options: [
			{
				displayName: 'CSS URL',
				name: 'cssUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/print.css',
				description: 'A stylesheet applied after the default one. PDF and HTML output only.',
			},
			{
				displayName: 'Header Image URL',
				name: 'headerImageUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/logo.png',
				description: 'An image shown above the title, such as a logo. PDF and HTML output only.',
			},
			{
				displayName: 'Header Text',
				name: 'headerText',
				type: 'string',
				default: '',
				description: 'A line of text shown above the title. PDF and HTML output only.',
			},
			{
				displayName: 'Include Links',
				name: 'includeLinks',
				type: 'boolean',
				default: false,
				description:
					'Whether to keep link and image addresses in Markdown and plain text output. Off by default: links keep their words and lose their addresses.',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				placeholder: 'e.g. pt-BR',
				description: "Language of the content. Defaults to the page's own.",
			},
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'options',
				options: [
					{ name: 'A4', value: 'a4' },
					{ name: 'Letter', value: 'letter' },
				],
				default: 'letter',
				description: 'Paper size for PDF and Word output',
			},
			{
				displayName: 'Run Asynchronously',
				name: 'runAsync',
				type: 'boolean',
				default: false,
				description:
					'Whether to run the conversion in the background. The node returns a job ID right away. Read the result with Get Job, or set a webhook URL. Use this for slow pages and large documents.',
			},
			{
				displayName: 'Source URL',
				name: 'sourceUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/article',
				description:
					'With HTML only. The address the HTML came from. It appears under the title and resolves relative links.',
			},
			{
				displayName: 'Text Direction',
				name: 'direction',
				type: 'options',
				options: [
					{ name: 'Left to Right', value: 'ltr' },
					{ name: 'Right to Left', value: 'rtl' },
				],
				default: 'ltr',
				description: "Text direction. Defaults to the page's own.",
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description:
					"Heading printed above HTML or Markdown. Ignored for a URL, which uses the page's own title.",
			},
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/hooks/printfriendly',
				description:
					"With 'Run Asynchronously' only. An HTTPS address that PrintFriendly posts the finished job to, signed in the X-PrintFriendly-Signature header.",
			},
		],
	},
];
