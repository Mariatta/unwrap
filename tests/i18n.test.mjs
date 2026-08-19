/**
 * Translation completeness.
 *
 * The failure this is really guarding against is a half-added string: someone
 * adds a key to `en` and forgets `zh`, and the Chinese UI silently falls back to
 * English. Or a placeholder like {off} gets dropped from a translation and the
 * byte offset vanishes from the readout. Both are invisible without a test.
 */
import { strings, readApp, appScript, runner } from './helpers.mjs';

const STR = strings();
const html = readApp();
const js = appScript();
const T = runner('Translations');

const en = Object.keys(STR.en), zh = Object.keys(STR.zh);
T.note(`en: ${en.length} keys · zh: ${zh.length} keys`);

T.section('Both languages carry the same keys');
const missingZh = en.filter(k => !(k in STR.zh));
const strayZh   = zh.filter(k => !(k in STR.en));
T.check('no key missing from zh', missingZh.length === 0, missingZh.join(', '));
T.check('no zh key absent from en', strayZh.length === 0, strayZh.join(', '));

T.section('Placeholders survive translation');
const ph = s => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');
let phBad = 0;
for (const k of en) {
  if (!(k in STR.zh)) continue;
  if (ph(STR.en[k]) !== ph(STR.zh[k])) {
    T.check(k, false, `en[${ph(STR.en[k])}] vs zh[${ph(STR.zh[k])}]`);
    phBad++;
  }
}
T.check('all placeholder sets match', phBad === 0);

T.section('Nothing is accidentally untranslated');
// Keys whose value is intentionally identical in both languages.
const SHARED = new Set(['v.rawScan', 'v.noStreams']);
const same = en.filter(k => k in STR.zh && STR.zh[k] === STR.en[k] && !SHARED.has(k));
T.check('no untranslated leftovers', same.length === 0, same.join(', '));

T.section('Every key the app asks for actually exists');
const markupKeys = [...html.matchAll(/data-t(?:html)?="([^"]+)"/g)].map(m => m[1]);
const badMarkup = [...new Set(markupKeys)].filter(k => !(k in STR.en));
T.check(`${new Set(markupKeys).size} markup keys resolve`, badMarkup.length === 0, badMarkup.join(', '));

// t('via.' + key) and friends are built at runtime; skip bare prefixes.
const callKeys = [...js.matchAll(/\bt\('([\w.]+)'/g)].map(m => m[1]).filter(k => !k.endsWith('.'));
const badCalls = [...new Set(callKeys)].filter(k => !(k in STR.en));
T.check(`${new Set(callKeys).size} t() keys resolve`, badCalls.length === 0, badCalls.join(', '));

T.section('Runtime-composed keys');
// audioFromStream() can emit any of these as `via`; each needs a translation.
for (const v of ['body', 'packager', 'packagerScan', 'scan']) {
  T.check(`via.${v} exists in both`, ('via.' + v) in STR.en && ('via.' + v) in STR.zh);
}

T.section('About page exists in both languages');
for (const lang of ['en', 'zh']) {
  const m = html.match(new RegExp(`data-only="${lang}"[^>]*>([\\s\\S]*?)\\n      </div>`));
  if (!T.check(`data-only="${lang}" block present`, !!m)) continue;
  const sections = (m[1].match(/<h2>/g) || []).length;
  T.check(`  ${lang}: 5 sections`, sections === 5, `${sections} found, ${m[1].length} chars`);
}

T.section('CJK typography guards are in place');
T.check('zh font stack overridden', /html\[lang="zh"\]\s*\{[^}]*--display/.test(html));
T.check('zh letter-spacing reset on h1', /html\[lang="zh"\]\s+h1\s*\{[^}]*letter-spacing:\s*0/.test(html));

T.done();
