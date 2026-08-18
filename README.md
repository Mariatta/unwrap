# Unwrap

**[English](README.md) · [简体中文](README.zh.md)**

Pull the audio back out of a Word document that has an MP3 buried inside it.

**→ [mariatta.ca/unwrap](https://mariatta.ca/unwrap/)**

## Nothing is uploaded

Your document never leaves your computer. There is no server, no upload, no
account, and no analytics: the page reads the file with the browser's own APIs and
writes the audio straight back to your downloads folder. You can open the page,
disconnect from the network, and it still works.

## Why this exists

An ESL teacher emails his class the lesson audio as an MP3 embedded inside a Word
document. On his machine that is a perfectly reasonable thing to do: he clicks the
speaker icon and the recording plays.

Everywhere else it falls apart. His students don't all run Windows, and on a Mac,
a phone, or a Chromebook the audio is right there in the file and completely
unreachable. The format failed, not the person. This tool is the missing half of
that email.

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
npm run serve        # http://localhost:8000
```

`npm run fixtures` needs Python 3 (standard library only). The tests need Node
20.11 or newer.

The whole app is `index.html`: markup, styles, both languages, and all the logic.
There is no build step.

## Credits

ZIP reading and writing by [JSZip](https://stuk.github.io/jszip/) (MIT).

## License

[MIT](LICENSE)
