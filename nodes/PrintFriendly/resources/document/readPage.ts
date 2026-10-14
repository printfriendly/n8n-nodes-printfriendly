import type { INodeProperties } from 'n8n-workflow';

const showOnlyForReadPage = {
	resource: ['document'],
	operation: ['readPage'],
};

export const documentReadPageDescription: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'pageUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://example.com/article',
		displayOptions: { show: showOnlyForReadPage },
		description:
			"The web page to read. PrintFriendly fetches it and keeps the article. Use a link to one article, not a site's front page.",
	},
	{
		displayName: 'Output Format',
		name: 'readOutput',
		type: 'options',
		options: [
			{
				name: 'JSON',
				value: 'json',
				description: 'The article in pieces: title, author, date, content and more',
			},
			{
				name: 'Markdown',
				value: 'markdown',
				description: 'The article as clean Markdown, in the content field',
			},
		],
		default: 'markdown',
		displayOptions: { show: showOnlyForReadPage },
		description: 'How to return the page',
	},
	{
		displayName: 'Options',
		name: 'readOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showOnlyForReadPage },
		options: [
			{
				displayName: 'Include Links',
				name: 'includeLinks',
				type: 'boolean',
				default: false,
				description:
					'Whether to keep link and image addresses. Off by default: links keep their words and lose their addresses, which makes the output much shorter.',
			},
		],
	},
];
