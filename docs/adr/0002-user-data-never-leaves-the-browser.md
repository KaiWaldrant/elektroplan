# User data never leaves the browser

Plans, project files, the Catalogus and everything generated from them stay in IndexedDB and in files the user saves; there is no upload, sync or telemetry. External fonts, styles and images are allowed, each host listed explicitly in the CSP, but scripts are always bundled and never loaded from a CDN, and `connect-src 'none'` stays, so the app itself cannot send data anywhere. The line is drawn at scripts because a third-party script can read the whole page and exfiltrate it without `fetch` (for example through an image URL), while a font or stylesheet host only learns that the app was opened.

## Consequences

- No cloud sync, sharing links or online catalog lookups; sharing a project means sending the project file.
- Every new external host is a CSP change and needs a deliberate decision.
