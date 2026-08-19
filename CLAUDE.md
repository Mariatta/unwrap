# Unwrap

A single-page, client-side tool that extracts audio embedded inside Word documents.
Everything ships in `index.html`: markup, CSS, both languages, and all logic. No
build step. Deployed to GitHub Pages from `main` at the repository root.

## Commands

```bash
npm install
npm run fixtures     # required before the first test run: tests/fixtures/ is gitignored
npm test
npm run serve        # prints its URL, including one a tablet can reach
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

## The page makes no third-party requests

JSZip is vendored at `vendor/jszip.min.js` and the webfonts at `vendor/fonts/`
(latin and latin-ext only; Chinese uses system CJK faces). Nothing is loaded from a
CDN or a font host, there is no analytics and there are no cookies, and the About
page says so without qualification in both languages. Re-adding any external
`<link>` or `<script src>` breaks that claim, so don't: add the file to `vendor/`
instead, with its licence text.

Font files come from Google Fonts' css2 endpoint, latin and latin-ext subsets of
the exact weights in use. All three families are SIL OFL 1.1 and their licence
texts sit beside them in `vendor/fonts/`.

## Favicon and the sharing card

The favicon is an inline SVG data URI in the `<link rel="icon">`, so it costs no
request. `apple-touch-icon.png` (180px) and `og.png` (1200x630) are generated from
sources in `tools/`, not hand-drawn, so regenerate rather than editing the PNGs:

```bash
rsvg-convert -w 180 -h 180 tools/icon.svg -o apple-touch-icon.png
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --window-size=1200,630 --force-device-scale-factor=1 \
  --screenshot=og.png "file://$PWD/tools/og-card.html"
magick og.png -strip -colors 128 og.png
```

`tools/og-card.html` loads the vendored webfonts by relative path, so the card uses
the same faces as the site. If the favicon SVG changes, update both `tools/icon.svg`
and the data URI in `index.html`: they are the same drawing in two places.

`og:image` must be an absolute URL, so it hardcodes `https://mariatta.ca/unwrap/`.
Change that if the site ever moves.

## Navigation and the About page

About is reachable from the footer only, not the top bar. The footer link carries
`data-nav="about"` because routing sets `aria-current` from `[data-nav]`, and
`tests/ui.test.mjs` asserts on both. The served page does not link out to Mastodon
at all: that link lives in the READMEs.

## The player is two controls on purpose

Each result card has a 56px play/pause button *and* the native `<audio controls>`
bar. The button exists because the native play control is a small hit area on a
tablet; the native bar stays for scrubbing, volume and the OS integration a custom
transport would have to reimplement. They drive the same element and follow each
other, so the button listens to the media's `play`, `pause` and `ended` events
rather than tracking its own state.

Only one result plays at a time. The listener is on `document` in the **capture**
phase, because `play` does not bubble. Moving it to a bubbling listener silently
stops it firing.

jsdom implements neither `play()` nor `pause()`, so the tests drive playback by
dispatching events and, for the pause-others rule, by replacing `pause` with a spy.

## Tests import the app by slicing it

`tests/helpers.mjs` extracts the core out of `index.html` by matching the section
banner comments. **Rename those comments and the tests fail with "core markers not
found".** Update `helpers.mjs` in the same commit.

## Tone

No em dashes anywhere, in the page or the docs: a colon or a comma instead.

The READMEs centre the student: someone non-technical who just wants to do her
homework, and who should not have to learn a terminal to hear this week's listening
exercise. That is the point of the tool, so keep it there if you rewrite copy.

The About page in `index.html` still tells the story from the teacher's side, and is
deliberately sympathetic to him: the format failed, not the person. Never let either
version read as blaming him.

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
