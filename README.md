# Unwrap

**[English](README.md) · [简体中文](README.zh.md)**

Pull the audio back out of a Word document that has an MP3 buried inside it.

**→ [mariatta.ca/unwrap](https://mariatta.ca/unwrap/)**

## Nothing is uploaded

Your document never leaves your computer. There is no server, no upload, and no
account: the page reads the file with the browser's own APIs and writes the audio
straight back to your downloads folder.

Extracted audio is kept in this browser so it is still there next time, on that
device and nowhere else. **Forget these**, above the kept files, removes it, and
so does clearing site data. Some browsers clear it themselves after a week or two
of not visiting.

It also contacts nobody else. No CDN, no font host, no analytics, no cookies:
JSZip and the webfonts are served from this repository, so loading the page makes
no third-party requests at all. Once you have the page, you can disconnect from the
network entirely and it still works.

## Why this exists

My mother-in-law takes English classes for new immigrants. The lesson audio arrives
as an MP3 embedded inside a Word document: fine on the machine it was made on, and
unreachable on hers.

She isn't a technical person, and she shouldn't have to become one to do her
homework. Every existing way to get that MP3 out asks something unreasonable of
her: run a command line tool, rename the file to `.zip` and go hunting through
folders full of XML, or upload her class material to whichever website turns up
first.

So this is a page instead. Drop the document on it, get the audio, go back to
studying. Nothing to install, no terminal, nothing new to learn, and the file never
leaves her computer.

The original post: <https://fosstodon.org/@mariatta/117114000531151134>

## What it handles

Documents saved by Word, PowerPoint, and Excel: `.docx`, `.docm`, `.doc`, `.dotx`,
`.pptx`, `.ppt`, `.xlsx`, `.xls`. Drop in several at once and it works through them
one at a time; at two or more results it offers everything as a single ZIP.

The interface is in English and Simplified Chinese. Your choice is remembered, and
on a first visit it follows your browser's language setting.

## One thing no tool can fix

If the sender used *Insert → Object → **Link to file***, the audio was never put
inside the document. The file holds only a path to an MP3 sitting on their own
computer. Nothing can recover it, here or anywhere else: ask them to send the MP3
as a normal attachment.

## How it works

A `.docx` is a ZIP. Inside it, an embedded object lives at
`word/embeddings/oleObject1.bin`, which is itself a whole
[OLE Compound File](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/)
: a small filesystem, with its own allocation table, directory tree, and a separate
stream for tiny files. Unwrap walks that structure the way the spec says to, rather
than assuming the MP3 sits in one contiguous run, because when that assumption is
wrong you get audio that is silently corrupted.

Inside the compound file, the payload is wrapped in an OLE 1.0 Packager header,
which carries the sender's original filename and the exact byte length. That is why
what you download is named sensibly and is byte-for-byte the file they inserted. If
that header can't be read, Unwrap falls back to scanning for audio signatures and
tells you in the results that the file may carry a few trailing bytes.

## Local development

```bash
npm install
npm run fixtures     # required before the first test run: tests/fixtures/ is gitignored
npm test
npm run serve        # prints its URL, including one a tablet can reach
```

`npm run fixtures` needs Python 3 (standard library only). The tests need Node
20.11 or newer.

The whole app is `index.html`: markup, styles, both languages, and all the logic.
There is no build step.

## Credits

ZIP reading and writing by [JSZip](https://stuk.github.io/jszip/) (MIT), bundled in
`vendor/`. Typefaces are Bricolage Grotesque, Public Sans, and IBM Plex Mono, all
SIL OFL 1.1, self-hosted in `vendor/fonts/` with their licence texts.

## License

[MIT](LICENSE)
