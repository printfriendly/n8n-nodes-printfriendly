# Changelog

## 0.1.0

First release.

- Credential `PrintFriendly API`: API key sent as `Authorization: Bearer`, with a credential test that does not use up a document.
- Node `PrintFriendly`, resource `Document`:
  - **Convert**: URL, HTML or Markdown to PDF, Word, Markdown, JSON, HTML or text, with title, page size, CSS URL, header text, header image URL, language, text direction, include links, source URL, run asynchronously and webhook URL options. PDF and Word output can be downloaded as binary data.
  - **Read Page**: a URL in, Markdown or JSON out.
  - **Get Job**: read an asynchronous conversion, with the same file download.
- API failures become n8n errors that carry the API's code and say what to do.
