# n8n-nodes-printfriendly

An [n8n](https://n8n.io/) community node for the [PrintFriendly API](https://www.printfriendly.com/api/instructions/v2). Turn a web page, some HTML or some Markdown into a PDF, a Word file, Markdown, JSON, HTML or plain text, from inside a workflow.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Example workflow](#example-workflow)
- [Errors](#errors)
- [Limits](#limits)
- [Compatibility](#compatibility)
- [Development](#development)
- [Resources](#resources)

## Installation

In n8n, go to **Settings > Community Nodes**, choose **Install**, and enter `n8n-nodes-printfriendly`. See the n8n guide to [installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/) for the details, including self-hosted installs from the command line.

## Credentials

The node uses one credential, **PrintFriendly API**.

1. Get a free API key at [printfriendly.com/me/api-key](https://www.printfriendly.com/me/api-key). The free plan includes 100 documents a month and needs no card.
2. In n8n, create a **PrintFriendly API** credential and paste the key into **API Key**.

The key is sent as `Authorization: Bearer <key>`. Leave **API Base URL** at its default, `https://api.printfriendly.com`, unless support asks you to change it.

**Test** on the credential checks the key without using up a document. The API has no endpoint that only checks a key, so the test reads a job ID that was never issued. A key the API knows gets `404 job_not_found`, which the test treats as success, and an unknown key gets `401 invalid_api_key`, which it reports as a rejected key. Anything else (a firewall block, a rate limit, an outage) is reported as a failed test.

## Operations

All operations are on the **Document** resource.

### Convert

Turns one source into one output.

| Field | What it does |
| --- | --- |
| Source Type | **URL** (PrintFriendly fetches the page and keeps the article), **HTML** or **Markdown** |
| URL / HTML / Markdown | The source. HTML up to 2 MB of markup, Markdown up to 1 MB |
| Output Format | **PDF**, **Word (DOCX)**, **Markdown**, **HTML**, **Plain Text** or **JSON** |
| Download File | PDF and Word only. Fetches the file and attaches it to the item as binary data (see below) |
| Put Output File in Field | Name of the binary field. Default `data` |
| File Name | Optional. Default is the document title, for example `eclipse.pdf` |

Options (all optional, left out of the request unless you add them):

| Option | API field | Notes |
| --- | --- | --- |
| Title | `title` | Heading above HTML or Markdown. Ignored for a URL |
| Page Size | `page_size` | Letter or A4. PDF and Word |
| CSS URL | `css_url` | A stylesheet applied after the default one. PDF and HTML |
| Header Text | `header_text` | A line of text above the title. PDF and HTML |
| Header Image URL | `header_image_url` | An image above the title, such as a logo. PDF and HTML |
| Language | `lang` | For example `en` or `pt-BR`. Default is the page's own |
| Text Direction | `dir` | Left to Right or Right to Left. Default is the page's own |
| Include Links | `include_links` | Keep link and image addresses in Markdown and text output |
| Source URL | `source_url` | HTML only. Where the HTML came from |
| Run Asynchronously | `async` | Run in the background and return a job ID (see Get Job) |
| Webhook URL | `webhook_url` | HTTPS address PrintFriendly posts the finished job to. Needs Run Asynchronously |

**What comes back.** The item is the API's JSON answer:

- PDF and Word: `file_url` (works for 48 hours), `expires_at`, `size_bytes`, `document` (title, author, date, site, excerpt, image, word count) and `usage`.
- Markdown, HTML and text: `content` and `document`.
- JSON: the whole article in `document`.
- Run Asynchronously: `status: "queued"`, `job_id`, `status_url` and `expires_at`.

**Download File.** With a PDF or Word output, switch on **Download File** and the node fetches `file_url` and adds the file to the item as binary data, with the right MIME type (`application/pdf`, or the Word one) and a file name taken from the document title. The JSON answer stays on the item, so `file_url` is still there. The download does not send your API key.

### Read Page

A shortcut for the common case: a URL in, the article out, as Markdown or as JSON. It is a `Convert` with the source fixed to a URL, so it counts as one document like any other conversion. The only option is **Include Links**, which keeps link and image addresses; leaving it off makes the Markdown much shorter, which suits AI agents and summaries.

### Get Job

Reads a conversion that was started with **Run Asynchronously**. Enter the `job_id` from Convert. The answer has `status` (`queued`, `processing`, `succeeded` or `failed`), and:

- when `succeeded`: `result`, which is exactly what a synchronous Convert returns, `usage` included;
- when `failed`: `error` with `code`, `message` and `retryable`.

A `failed` job is returned as data, not thrown, so a workflow can branch on `status`. While a job is unfinished the API asks for about 2 seconds between reads. **Download File** works here too: once the job has succeeded with a PDF or Word file, the node attaches it exactly as Convert does. Only the API key that started a job can read it, and jobs are kept for 48 hours.

The node can be used as a tool by an AI agent. Read Page is the one built for that.

## Example workflow

A URL in, a PDF file out. Import it with **Workflow > Import from File** (or paste it onto the canvas), then pick your credential on the PrintFriendly node. Connect the output to anything that takes binary data: an email attachment, Google Drive, S3, Slack, or **Read/Write Files from Disk**.

```json
{
  "name": "Web page to PDF",
  "nodes": [
    {
      "parameters": {},
      "name": "When clicking Execute workflow",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [0, 0]
    },
    {
      "parameters": {
        "resource": "document",
        "operation": "convert",
        "sourceType": "url",
        "url": "https://en.wikipedia.org/wiki/Pangram",
        "output": "pdf",
        "downloadFile": true,
        "binaryPropertyName": "data",
        "options": { "pageSize": "a4" }
      },
      "name": "PrintFriendly",
      "type": "n8n-nodes-printfriendly.printFriendly",
      "typeVersion": 1,
      "position": [240, 0]
    }
  ],
  "connections": {
    "When clicking Execute workflow": {
      "main": [[{ "node": "PrintFriendly", "type": "main", "index": 0 }]]
    }
  }
}
```

For a slow page, switch on **Run Asynchronously** in Options, then add a **Wait** node and a second PrintFriendly node set to **Get Job** with `{{ $json.job_id }}` as the Job ID and **Download File** on. If the job is still `processing`, wait and read it again.

## Errors

Failed calls are free: only a successful conversion counts against your plan. When the API refuses a request, the node stops with an error whose title carries the API's code and whose description says what to do, quotes what PrintFriendly said, and gives the request ID to quote to support. With **Continue On Fail** on, the item carries the error instead.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `invalid_parameters` | 400 | A field is missing or wrong. The fields are named |
| `html_too_large` | 400, 413, 422 | The HTML is over the size limit |
| `api_key_required`, `invalid_api_key` | 401 | No key, or an unknown key |
| `subscription_inactive`, `limit_exceeded` | 401 | The plan has ended, or the key hit its own limit |
| `quota_exceeded` | 402 | No documents left this period. The description links to the upgrade page |
| `rate_limited` | 429 | Too many requests. Turn on **Retry On Fail** in the node settings |
| `fetch_failed` | 422 | The page could not be loaded. Can be retried |
| `parse_failed`, `homepage_url` | 422 | No article found, or the URL is a front page |
| `content_blocked` | 422 | The content failed PrintFriendly's content checks. Do not retry |
| `render_timeout`, `render_failed` | 422 | The conversion did not finish. Can be retried, or run it asynchronously |
| `job_not_found` | 404 | Wrong job ID, another key's job, or older than 48 hours |

A response that is not JSON at all (for example a firewall block page) is reported as `PrintFriendly did not answer with JSON`, with the HTTP status.

## Limits

These come from the [API documentation](https://www.printfriendly.com/api/instructions/v2).

- **Documents:** the free plan includes 100 a month. One successful call is one document, whatever the output. Paid plans include more.
- **Free plan PDFs** carry the line "Made with the PrintFriendly API" at the foot of every page, and HTML output carries it once at the end. Markdown, JSON, text and Word have none. Paid plans have none.
- **Request rate:** 10 requests a minute on the free plan, 120 on paid plans. Reading a job has its own limit, 120 a minute free and 600 paid.
- **Time:** a synchronous call answers within 27 seconds, or with `render_timeout`. An asynchronous job has up to 55 seconds.
- **Background jobs:** 3 unfinished jobs per key on the free plan, 20 on paid plans. Jobs and their results are kept for 48 hours.
- **Size:** HTML up to 2 MB of markup (50 MB with embedded images), Markdown up to 1 MB.
- **Files:** PDF and Word links work for 48 hours, so download them if you need them longer.
- Use is governed by the [Acceptable Use Policy](https://www.printfriendly.com/acceptable-use-policy).

## Compatibility

Built against n8n 2.x (`n8n-workflow` 2.x) with the `@n8n/node-cli` toolchain. The node is declarative, has no runtime dependencies and uses no file system or environment access. The credential test relies on the `ignoreHttpStatusErrors` `except` list, which older n8n versions do not understand; there the test may report success for a rejected key, and the first run of the node will then show the real answer.

## Development

Use Node.js 24 or later. Current `n8n-workflow` releases depend on `isolated-vm`, which needs Node.js 24 and fails to compile on Node.js 20.

```sh
npm install
npm run build   # compile and copy icons into dist/
npm run lint    # n8n's community-node lint rules, including eslint-plugin-n8n-nodes-base
npm test        # builds, then runs the unit tests in test/
npm run dev     # a local n8n with the node loaded (newer n8n versions need Docker or Podman)
```

`scripts/live-check.mjs` runs the node's own request builder, error mapping and file download against the real API, without an n8n instance. By default it uses two documents (one Read Page, one Convert to PDF with Download File), plus free checks of the credential test and of three refused calls:

```sh
PRINTFRIENDLY_API_KEY=your-key node scripts/live-check.mjs
# only the steps that cost no document:
PRINTFRIENDLY_API_KEY=your-key node scripts/live-check.mjs --steps probe,errors
```

To release, follow n8n's [submit community nodes](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/) guide. The package must be published from a GitHub Actions workflow with provenance, which `.github/workflows/publish.yml` does when you push a version tag.

## Resources

- [PrintFriendly API documentation](https://www.printfriendly.com/api/instructions/v2)
- [OpenAPI spec](https://www.printfriendly.com/openapi.json)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
