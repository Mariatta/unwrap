# Unwrap

A single-page, client-side tool that extracts audio embedded inside Word documents.
Everything ships in `index.html`: markup, CSS, both languages, and all logic. No
build step. Deployed to GitHub Pages from `main` at the repository root.

## Commands

```bash
npm install
npm run fixtures     # required before the first test run: tests/fixtures/ is gitignored
npm test
npm run serve        # http://localhost:8000
```

Tests need Node 20.11 or newer. `npm run fixtures` needs Python 3, standard library
only.

## Structure of index.html

In order: `<style>`, then markup (sticky nav, `#view-extract`, `#view-about`,
footer), then `<script>` in labelled sections: `Strings` (the `STR` table plus
`t(key, vars)`), the MS-CFB reader, the OLE 1.0 Packager parser, audio sniffing,
`Analysis`, `Render`, language and routing, wiring.

State:

```js
state = {
  docs:    [{ meta: {name, size}, rows: [...], empty, count }],
  results: [{ kind, data, name, source, doc, via, offset, url }]
}
```

`results` is flat across all documents so every player can be listed together above
the per-document listing.

## Do not "simplify" these

Each looks like over-engineering and is not. All are covered by tests. Run
`npm test` before and after touching this area.

- **The analysis/render split.** `analyse()` returns data and touches no DOM;
  `renderResults()` reads state and writes DOM. This is what lets the language
  switch re-render loaded results without re-parsing the documents. Move logic
  across that line and switching language mid-session drops results. Covered by
  `tests/ui.test.mjs`.
- **The CFB parser follows sector chains properly.** The payload is usually
  contiguous, and when it isn't, slicing gives you silently corrupted audio. Keep
  the chain walk.
- **`mpegRun()` requires four consecutive valid MPEG frames.** A lone `FF Ex` pair
  occurs constantly in binary data. There is a test with 50KB of solid `0xFF` that
  exists only to catch a relaxed sync check.
- **The Packager header's `dataLen` is authoritative.** It gives the exact payload
  length and the sender's original filename. The magic-byte scan is a *fallback*,
  not an equivalent path, and its results are flagged in the UI.
- **`localStorage` access is wrapped in try/catch.** It throws in sandboxed frames;
  the language preference degrades to `navigator.language`. Don't unwrap it.
- **Blob URLs are revoked when a new batch loads.** Otherwise every extracted MP3
  stays resident.
- **`Object.assign(w, { Uint8Array, ... })` in `tests/helpers.mjs` is a jsdom
  workaround.** jsdom puts the page and Node's JSZip in different JS realms, so
  `loadAsync` rejects the page's typed arrays. Real browsers have one realm. Don't
  "fix" this in `index.html`.

## Tests import the app by slicing it

`tests/helpers.mjs` extracts the core out of `index.html` by matching the section
banner comments. **Rename those comments and the tests fail with "core markers not
found".** Update `helpers.mjs` in the same commit.

## Tone

The About page and READMEs frame the teacher sympathetically on purpose: the format
failed, not the person. Keep that if you rewrite copy.

## Settled decisions

- Client-side, not a server: a server would mean accepting untrusted binary uploads
  and owning the privacy question for other people's audio.
- Hash routing (`#/`, `#/about`), not separate HTML files. One file, no Pages 404
  config, still shareable.
- In-DOM dual content for About prose (`data-only="en|zh"`, toggled by CSS), `STR`
  table for short dynamic UI strings.
- System CJK fonts, no CJK webfont.
- Sequential document processing: bounded memory, and the progress line can name a
  file.
- ZIP bundling at 2+ results: browsers throttle sequential downloads, and
  same-named files from different documents would clobber each other.
