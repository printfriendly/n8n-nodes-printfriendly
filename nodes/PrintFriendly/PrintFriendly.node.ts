import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { documentDescription } from './resources/document';

export class PrintFriendly implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'PrintFriendly',
		name: 'printFriendly',
		icon: {
			light: 'file:../../icons/printfriendly.svg',
			dark: 'file:../../icons/printfriendly.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Turn web pages, HTML and Markdown into PDF, Word, Markdown, JSON, HTML or text with the PrintFriendly API',
		defaults: {
			name: 'PrintFriendly',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'printFriendlyApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL:
				'={{ ($credentials.baseUrl || "https://api.printfriendly.com").replace(/\\/+$/, "") }}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Document',
						value: 'document',
					},
				],
				default: 'document',
			},
			...documentDescription,
		],
	};
}
