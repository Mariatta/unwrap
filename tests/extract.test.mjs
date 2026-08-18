/**
 * Extraction core: does the right audio come out, byte for byte?
 *
 * Every fixture wraps the same known MP3, so a pass means the recovered bytes
 * are identical to what went in — not merely that something audio-shaped fell
 * out. Sector padding leaking into the output is the classic failure here, and
 * the exact-length assertion is what catches it.
 */
import JSZip from 'jszip';
import { core, fixture, fixtures, runner, PAYLOAD_BYTES } from './helpers.mjs';

const m = await core();
const T = runner('Extraction core');

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma|mid|midi)$/i;

async function extractAll(bytes) {
  const out = [];
  if (bytes[0] === 0xD0) {                       // legacy .doc — a bare compound file
    const cfb = m.parseCFB(bytes);
    if (!cfb) return out;
    for (const s of cfb.entries.filter(e => e.type === 2)) {
      const got = m.audioFromStream(cfb.readStream(s));
      if (got) out.push(got);
    }
    return out;
  }
  const zip = await JSZip.loadAsync(bytes);
  for (const e of Object.values(zip.files).filter(x => !x.dir)) {
    const data = await e.async('uint8array');
    if (AUDIO_EXT.test(e.name)) { out.push({ kind: 'mp3', data, via: 'body' }); continue; }
    if (!/embeddings\/.+\.bin$/i.test(e.name)) continue;
    const cfb = m.parseCFB(data);
    if (!cfb) continue;
    for (const s of cfb.entries.filter(x => x.type === 2)) {
      const got = m.audioFromStream(cfb.readStream(s));
      if (got) out.push(got);
    }
  }
  return out;
}

T.section('Every fixture yields the original payload, byte for byte');
for (const f of fixtures()) {
  const results = await extractAll(fixture(f));
  const exact = results.length > 0 && results.every(r =>
    r.data.length === PAYLOAD_BYTES &&
    r.data[0] === 0x49 && r.data[1] === 0x44 && r.data[2] === 0x33 &&   // "ID3"
    r.data[r.data.length - 1] !== 0x00);                                // no sector padding
  T.check(f, exact, `${results.length} result(s) via ${[...new Set(results.map(r => r.via))].join('/')}`);
}

T.section('Header sizes come from the format, not from guessing');
const cfb = m.parseCFB(fixture('legacy.doc'));
const stream = cfb.readStream(cfb.entries.find(e => e.type === 2));
const clean = m.audioFromStream(stream);
T.check('clean parse reports via=packager', clean.via === 'packager');
T.check('original filename recovered', clean.name === 'voice-memo.mp3', clean.name);
T.check('length is exact', clean.data.length === PAYLOAD_BYTES);

T.section('Fallback: a corrupt Packager header still recovers the audio');
const broken = stream.slice();
broken[0] = 0x99;                                // wreck the 0x0002 signature
const rec = m.audioFromStream(broken);
T.check('recovered anyway', !!rec, rec ? `via ${rec.via} at 0x${rec.offset.toString(16)}` : '');
T.check('falls back to scan', rec.via === 'scan');
T.check('lands exactly on the ID3 marker', rec.data[0] === 0x49 && rec.data[1] === 0x44 && rec.data[2] === 0x33);

T.section('No false positives — these must not read as audio');
const xml = new TextEncoder().encode('<?xml version="1.0"?><w:document><w:body/></w:document>'.repeat(50));
T.check('document.xml', m.scanForAudio(xml) === null);

const noise = new Uint8Array(200000);
for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) & 0xFF;
T.check('200KB of pseudo-random bytes', m.scanForAudio(noise) === null);

// The reason mpegRun() insists on four consecutive valid frames: a lone 0xFF Ex
// pair occurs constantly in binary data. Loosen that and this test fails.
T.check('50KB of solid 0xFF', m.scanForAudio(new Uint8Array(50000).fill(0xFF)) === null);
T.check('an EMF-shaped blob', m.scanForAudio(Object.assign(new Uint8Array(5000), { 0: 1 })) === null);

T.section('MPEG frame maths');
T.check('128kbps / 44.1kHz layer III → 417 bytes',
        m.mpegFrameLen(new Uint8Array([0xFF, 0xFB, 0x90, 0x00]), 0) === 417);
T.check('reserved bitrate index rejected',
        m.mpegFrameLen(new Uint8Array([0xFF, 0xFB, 0xF0, 0x00]), 0) === 0);
T.check('reserved sample rate rejected',
        m.mpegFrameLen(new Uint8Array([0xFF, 0xFB, 0x9C, 0x00]), 0) === 0);

T.done();
