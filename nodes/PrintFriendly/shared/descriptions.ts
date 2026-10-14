import type { INodeProperties } from 'n8n-workflow';

/**
 * 'Download File' and the two fields that go with it. Convert and Get Job both use them, each
 * with its own `displayOptions`, so the properties share names and `getNodeParameter` reads
 * whichever pair is on screen.
 */
export function downloadFileFields(
	show: NonNullable<INodeProperties['displayOptions']>['show'],
	description: string,
): INodeProperties[] {
	return [
		{
			displayName: 'Download File',
			name: 'downloadFile',
			type: 'boolean',
			default: false,
			displayOptions: { show },
			description,
		},
		{
			displayName: 'Put Output File in Field',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			required: true,
			displayOptions: { show: { ...show, downloadFile: [true] } },
			hint: 'The name of the output binary field to put the file in',
		},
		{
			displayName: 'File Name',
			name: 'fileName',
			type: 'string',
			default: '',
			placeholder: 'e.g. report.pdf',
			displayOptions: { show: { ...show, downloadFile: [true] } },
			description:
				'Name for the downloaded file. Leave empty to use the document title. The extension is added if it is missing.',
		},
	];
}
