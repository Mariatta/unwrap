import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';

export const HERE = import.meta.dirname;
export const ROOT = path.join(HERE, '..');
export const APP  = path.join(ROOT, 'index.html');
export const FIX  = path.join(HERE, 'fixtures');

/** Every fixture wraps this exact payload, so any extraction result can be
 *  checked byte-for-byte rather than merely "looks like audio". */
export const PAYLOAD_BYTES = 83420;

export const readApp    = () => fs.readFileSync(APP, 'utf8');
export const appScript  = () => readApp().split('<script>').pop().split('</script>')[0];
export const fixture    = name => new Uint8Array(fs.readFileSync(path.join(FIX, name)));
export const fixtures   = () => fs.readdirSync(FIX).sort();

/** Import the extraction core (CFB reader, Packager parser, sniffers) as a module.
 *  Sliced out of the page so the tests exercise the shipped source, not a copy. */
export async function core() {
  const js = appScript();
  const start = js.indexOf('const ENDOFCHAIN');
  const end   = js.indexOf('/* ============================================================\n   Analysis');
  if (start < 0 || end < 0) throw new Error('core markers not found in index.html — did the section comments change?');
  return import('data:text/javascript,' + encodeURIComponent(
    js.slice(start, end) +
    '\nexport { parseCFB, parsePackager, sniff, scanForAudio, audioFromStream, mpegFrameLen };'
  ));
}

/** Parse the STR table without running the rest of the page. */
export function strings() {
  const js = appScript();
  const src = js.slice(js.indexOf('const STR = {'), js.indexOf('\nlet lang'));
  return new Function(src + '; return STR;')();
}

/** A jsdom window with the page loaded and running.
 *  Returns { w, blobs } where blobs.created / blobs.revoked count object URLs. */
export function makeWindow() {
  const html = readApp().replace(/<script src="https:\/\/cdnjs[^>]*><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
  const w = dom.window;

  w.JSZip = JSZip;

  // jsdom puts the page and our Node-side JSZip in different JS realms, so typed
  // arrays the page builds look foreign to JSZip and loadAsync rejects them.
  // Real browsers have a single realm. Do not "fix" this by changing index.html.
  Object.assign(w, { Uint8Array, Uint32Array, DataView, ArrayBuffer });

  // jsdom has no layout, so scrollTo() logs a "not implemented" stack on every
  // route change. Stub it to keep test output readable.
  w.scrollTo = () => {};

  const blobs = { created: 0, revoked: 0, last: null };
  w.URL.createObjectURL = (b) => { blobs.created++; blobs.last = b; return 'blob:stub' + blobs.created; };
  w.URL.revokeObjectURL = () => { blobs.revoked++; };

  w.eval(appScript());
  return { w, blobs };
}

/** Build a File the page can read. jsdom's File lacks a usable arrayBuffer(). */
export function fileFrom(name, bytes) {
  return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer };
}

export const fixtureFile = (fixtureName, as) => fileFrom(as || fixtureName, fixture(fixtureName));

/** Minimal assertion harness — no dependency, readable output. */
export function runner(title) {
  let failed = 0;
  console.log(title);
  return {
    section: (s) => console.log('\n' + s),
    note: (s) => console.log('       ' + s),
    check(name, cond, detail = '') {
      console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
      if (!cond) failed++;
      return cond;
    },
    done() {
      console.log(failed ? `\n${failed} FAILED` : '\nall good');
      process.exit(failed ? 1 : 0);
    }
  };
}
