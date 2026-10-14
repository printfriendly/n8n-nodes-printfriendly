export interface ApiErrorInfo {
	/** The API's machine-readable code, when the body carried one. */
	code?: string;
	/** Short summary of what happened. Shown as the title of the n8n error. */
	message: string;
	/** What to do next, plus the API's own wording. Shown below the title. */
	description: string;
	/** HTTP status as a string, which is what NodeApiError expects. */
	httpCode: string;
	retryable?: boolean;
}

interface Summary {
	message: string;
	hint: string;
}

/** Plain-language summaries for the codes in the OpenAPI spec (ErrorCode). */
const SUMMARIES: Record<string, Summary> = {
	invalid_parameters: {
		message: 'PrintFriendly did not accept the request',
		hint: 'Check the node fields named below and run it again.',
	},
	api_key_required: {
		message: 'No API key was sent to PrintFriendly',
		hint: "Select a 'PrintFriendly API' credential with your API key.",
	},
	invalid_api_key: {
		message: 'PrintFriendly does not recognise this API key',
		hint: "Create a key at https://www.printfriendly.com/me/api-key and update the 'PrintFriendly API' credential.",
	},
	subscription_inactive: {
		message: 'The plan behind this API key has ended',
		hint: 'Renew the plan or use a key from an active plan.',
	},
	limit_exceeded: {
		message: 'This API key has reached the limit set on it',
		hint: 'Raise the limit on the key, or use another key.',
	},
	quota_exceeded: {
		message: 'This plan has no documents left',
		hint: 'Wait for the next monthly period or upgrade the plan.',
	},
	rate_limited: {
		message: 'PrintFriendly is receiving too many requests from this key',
		hint: "Wait a few seconds and run the node again. Turning on 'Retry On Fail' in the node settings does this for you.",
	},
	fetch_failed: {
		message: 'PrintFriendly could not load the page',
		hint: 'The site may be down, slow, or blocking PrintFriendly. Check the URL in a browser, or send the HTML directly.',
	},
	parse_failed: {
		message: 'PrintFriendly found no article in the page',
		hint: 'Use a link to a single article, or send the HTML directly.',
	},
	render_timeout: {
		message: 'The conversion took longer than 27 seconds',
		hint: "Turn on 'Run Asynchronously' in Options and read the result with Get Job, or try again.",
	},
	render_failed: {
		message: 'PrintFriendly could not finish the conversion',
		hint: 'Try again in a moment.',
	},
	html_too_large: {
		message: 'The HTML is too large for PrintFriendly',
		hint: 'Send less than 2 MB of markup (50 MB with embedded images), or use a URL.',
	},
	homepage_url: {
		message: "The URL is a site's front page, not an article",
		hint: 'Send a link to one article.',
	},
	content_blocked: {
		message: 'PrintFriendly blocked this content',
		hint: "The page did not pass PrintFriendly's content checks (https://www.printfriendly.com/acceptable-use-policy). Retrying will not help.",
	},
	job_not_found: {
		message: 'PrintFriendly has no job with that ID',
		hint: 'Check the ID. A job can only be read with the API key that started it, and it is kept for 48 hours.',
	},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function headerValue(headers: unknown, name: string): string | undefined {
	if (!isRecord(headers)) return undefined;
	const wanted = name.toLowerCase();
	for (const key of Object.keys(headers)) {
		if (key.toLowerCase() === wanted) {
			const value = headers[key];
			return Array.isArray(value) ? asString(value[0]) : asString(value);
		}
	}
	return undefined;
}

/** `{ url: ['is not a valid URL'] }` becomes `url: is not a valid URL`. */
function formatFieldErrors(errors: unknown): string | undefined {
	if (!isRecord(errors)) return undefined;
	const parts: string[] = [];
	for (const [field, problems] of Object.entries(errors)) {
		const text = Array.isArray(problems) ? problems.map(String).join(', ') : String(problems);
		parts.push(`${field}: ${text}`);
	}
	return parts.length > 0 ? parts.join('; ') : undefined;
}

function looksLikeHtml(body: unknown): boolean {
	return typeof body === 'string' && /^\s*<(!doctype|html|head|body)/i.test(body);
}

/**
 * Turns a failed PrintFriendly response (any status of 400 or more) into the pieces of an n8n
 * error. It reads both body shapes in the spec, `ValidationError` and `GenerationError`, and
 * copes with bodies that are not JSON at all, such as a firewall's block page.
 */
export function describeApiError(
	statusCode: number,
	body: unknown,
	headers?: unknown,
): ApiErrorInfo {
	const httpCode = String(statusCode);
	const requestId = headerValue(headers, 'x-request-id');
	const retryAfterHeader = headerValue(headers, 'retry-after');

	const root = isRecord(body) ? body : {};
	const err = isRecord(root.error) ? root.error : {};
	const code = asString(err.code);
	const apiMessage = asString(err.message) ?? asString(root.message);
	const fieldErrors = formatFieldErrors(err.errors);
	const retryable = typeof err.retryable === 'boolean' ? err.retryable : undefined;
	const upgradeUrl = asString(err.upgrade_url);
	const retryAfter =
		typeof err.retry_after_seconds === 'number'
			? String(err.retry_after_seconds)
			: retryAfterHeader;

	const summary = code ? SUMMARIES[code] : undefined;

	let message: string;
	const hints: string[] = [];

	if (summary) {
		message = `${summary.message} (${code})`;
		hints.push(summary.hint);
	} else if (code) {
		message = `PrintFriendly answered with ${code} (HTTP ${httpCode})`;
	} else if (looksLikeHtml(body)) {
		message = `PrintFriendly did not answer with JSON (HTTP ${httpCode})`;
		hints.push(
			'A firewall, proxy or bot filter between n8n and PrintFriendly probably returned its own page. Check that this n8n instance can reach the API host from its network.',
		);
	} else {
		message = `PrintFriendly answered with HTTP ${httpCode}`;
	}

	if (code === 'quota_exceeded' && upgradeUrl) {
		hints.push(`Upgrade at ${upgradeUrl}.`);
	}
	if (code === 'rate_limited' && retryAfter) {
		hints.push(`PrintFriendly asks for ${retryAfter} seconds before the next request.`);
	}
	if (retryable === true) {
		hints.push('Sending the same request again can work.');
	} else if (retryable === false && code && !summary) {
		hints.push('Sending the same request again will not help.');
	}

	// What PrintFriendly itself said, ended with a full stop so the next sentence reads cleanly.
	const said =
		fieldErrors ?? (apiMessage && apiMessage !== message ? `"${apiMessage}"` : undefined);
	if (said) hints.push(`PrintFriendly said: ${said}${/[.!?"]$/.test(said) ? '' : '.'}`);
	if (requestId) hints.push(`Request ID for support: ${requestId}.`);

	return {
		code,
		message,
		description: hints.join(' '),
		httpCode,
		retryable,
	};
}
