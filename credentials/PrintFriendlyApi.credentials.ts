import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class PrintFriendlyApi implements ICredentialType {
	name = 'printFriendlyApi';

	displayName = 'PrintFriendly API';

	icon: Icon = {
		light: 'file:../icons/printfriendly.svg',
		dark: 'file:../icons/printfriendly.svg',
	};

	documentationUrl = 'https://www.printfriendly.com/api/instructions/v2';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Get a free key at https://www.printfriendly.com/me/api-key. The free plan includes 100 documents a month.',
		},
		{
			displayName: 'API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.printfriendly.com',
			description:
				'The PrintFriendly API address. Leave the default unless support asks you to change it.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	/*
	 * The API has no endpoint whose only job is to check a key, and a conversion would use up
	 * one of the plan's documents. Reading a job costs nothing and is not blocked when a free
	 * key has used its month, and the API checks the key before it looks the job up: an unknown
	 * key answers 401 invalid_api_key, a known key answers 404 job_not_found for an ID that was
	 * never issued. So 404 is the "key accepted" answer here.
	 *
	 * `ignoreHttpStatusErrors` makes n8n treat 404 as a normal response, and `except` keeps every
	 * status that really means "not verified" (a rejected key, a firewall block, a rate limit,
	 * an outage) as a failed test.
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{ ($credentials.baseUrl || "https://api.printfriendly.com").replace(/\\/+$/, "") }}',
			url: '/v2/jobs/00000000-0000-4000-8000-000000000000',
			method: 'GET',
			ignoreHttpStatusErrors: {
				ignore: true,
				except: [400, 401, 402, 403, 408, 422, 429, 500, 502, 503, 504],
			},
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 401,
					message:
						'PrintFriendly does not recognise this API key. Create one at https://www.printfriendly.com/me/api-key.',
				},
			},
		],
	};
}
