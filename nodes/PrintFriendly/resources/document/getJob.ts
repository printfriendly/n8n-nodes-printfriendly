import type { INodeProperties } from 'n8n-workflow';
import { downloadFileFields } from '../../shared/descriptions';

const showOnlyForGetJob = {
	resource: ['document'],
	operation: ['getJob'],
};

export const documentGetJobDescription: INodeProperties[] = [
	{
		displayName: 'Job ID',
		name: 'jobId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 5b1f6a52-0c0e-4d8e-9d8f-3f0a6a7d1c21',
		displayOptions: { show: showOnlyForGetJob },
		description:
			"The job_id that Convert returned with 'Run Asynchronously' on. Only the API key that started a job can read it, and jobs are kept for 48 hours.",
	},
	...downloadFileFields(
		showOnlyForGetJob,
		'Whether to download the finished file and attach it to the item as binary data. Only applies once the job has succeeded with a PDF or Word file.',
	),
];
