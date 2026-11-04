# Lesson document import

Create Lesson includes an optional document importer for verified `admin`,
`leader`, `pascal`, and `pamela` accounts. Select a DOCX, PDF, HTML/HTM, or UTF-8
TXT file up to 10 MB and click **Import document**. Importing replaces the form's
title and partitions; the UI shows a replacement notice when those fields already
contain text. Review and edit the result, add the required image, lesson name,
and year, then save using the existing **Create Lesson** action.

`POST /api/lessons/import` accepts multipart form data with one file named
`document`. Authentication and current database-backed role checks run before
the upload middleware. The response contains an editable draft, without creating
a lesson or storing the uploaded document:

```json
{
  "success": true,
  "draft": {
    "title": "Faith",
    "partitions": [{ "title": "Introduction", "body": "God loves us." }]
  },
  "warnings": []
}
```

DOCX uses Word heading styles; HTML uses `h1` through `h6`. Text and PDF exports
recognize Markdown headings, underlined headings, short all-capital lines, and
short labels ending with a colon. Normal paragraphs remain together. The first
heading becomes the suggested lesson title, with the HTML document title taking
precedence when present; otherwise the filename supplies the title. Text before
the first heading is retained in an Introduction partition. Documents without
headings return one **Lesson content** partition and a warning.

This is deterministic heading detection, with no AI inference or OCR. Scanned
or image-only PDFs return a message asking the user to run OCR first. Legacy
`.doc` files must be saved as `.docx`. Encrypted, damaged, and empty documents
return errors. Output is plain text; images, styling, executable HTML, and links
are not imported. DOCX external file access is disabled. PDF extraction is
limited to 200 pages.

The importer allows 20 attempts per account per hour, with at most two parsers
running per API process. Parsing runs in a worker with a 30-second deadline and
a 256 MB JavaScript heap limit. Drafts are limited to 100 nonempty partitions and
80 KB of JSON so they fit within the existing 100 KB lesson creation request
limit. Oversized drafts are rejected rather than silently truncated.

The backend dependencies and lockfile include `multer`, `mammoth`, `cheerio`, and
`pdf-parse`; normal `npm ci --prefix backend` installs them. The existing Docker
build copies the importer and shared file policy automatically.

Production Traefik gives `POST /api/lessons/import` a separate upload allowance
of 10 MiB plus 64 KiB for multipart overhead. Other JSON API routes retain their
100 KB proxy limit. The document allowance stays in memory because the Traefik
container uses a read-only filesystem. Keep the proxy allowance in sync with
`MAX_LESSON_DOCUMENT_BYTES` when changing the file size policy.

After deploying a change to this allowance, also update
`deployment/traefik/dynamic.yml` on the production host. It is mounted from the
host, so publishing or updating application images alone does not replace it.
Traefik watches the directory and reloads the configuration automatically.
The browser ends import requests after 90 seconds and displays a retry message
if the network or server does not finish responding.

Validation:

```sh
node --test backend/tests/lessonImport.test.js frontend/tests/lessonImport.test.js
npm run build --prefix frontend
```

Integration tests use real multipart HTTP requests, real DOCX/PDF documents,
the existing authenticated router, and the normal lesson creation endpoint.
Database collection I/O is stubbed. Frontend rendering tests verify the uploader
and required fields for all creator roles.

Library references: [Multer](https://expressjs.com/en/resources/middleware/multer/),
[Mammoth](https://github.com/mwilliamson/mammoth.js),
[pdf-parse](https://github.com/mehmet-kozan/pdf-parse).
