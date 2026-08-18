/**
 * Page behaviour: routing, language switching, and one document end to end.
 *
 * The interesting case is switching language *after* an extraction. Results are
 * re-rendered from the stored data model rather than re-parsed, so a regression
 * here looks like results vanishing, or labels stuck in the old language.
 */
import { makeWindow, fixtureFile, runner } from './helpers.mjs';

const { w } = makeWindow();
const T = runner('Page behaviour');

const $  = s => w.document.querySelector(s);
const $$ = s => [...w.document.querySelectorAll(s)];
const txt = s => ($(s) ? $(s).textContent.trim() : '(missing)');
const click = s => $(s).dispatchEvent(new w.Event('click'));

T.section('Initial state');
T.check('defaults to English', w.document.documentElement.lang === 'en');
T.check('extract view visible', !w.document.getElementById('view-extract').hidden);
T.check('about view hidden', w.document.getElementById('view-about').hidden);
T.check('nav marks extract as current', $('[data-nav="extract"]').getAttribute('aria-current') === 'page');
T.check('English prose shown', !$('[data-only="en"]').hidden);
T.check('Chinese prose hidden', $('[data-only="zh"]').hidden);
T.note('h1: ' + txt('#view-extract h1'));

T.section('Layout contract: players sit above the listing');
const sections = [...w.document.getElementById('view-extract').querySelectorAll('section')].map(s => s.id);
T.check('results before trace', sections.indexOf('results') < sections.indexOf('trace'), sections.join(' → '));

T.section('Switching to 中文');
click('.langswitch button[data-lang="zh"]');
T.check('html lang=zh', w.document.documentElement.lang === 'zh');
T.check('headline translated', txt('#view-extract h1') === '那份 Word 文档里，藏着一个音频文件。');
T.check('drop label translated', txt('.drop-lead') === '选择文件，或把文件拖到这里');
T.check('nav translated', txt('[data-nav="about"]') === '关于');
T.check('document title translated', w.document.title.includes('从 Word 文档中取出音频'));
T.check('Chinese prose shown', !$('[data-only="zh"]').hidden);
T.check('English prose hidden', $('[data-only="en"]').hidden);
T.check('aria-pressed tracks the choice',
  $('[data-lang="zh"]').getAttribute('aria-pressed') === 'true' &&
  $('[data-lang="en"]').getAttribute('aria-pressed') === 'false');
T.check('choice persisted', w.localStorage.getItem('unwrap.lang') === 'zh');

T.section('Routing to #/about');
w.location.hash = '#/about';
w.dispatchEvent(new w.Event('hashchange'));
T.check('about visible', !w.document.getElementById('view-about').hidden);
T.check('extract hidden', w.document.getElementById('view-extract').hidden);
T.check('nav marks about as current', $('[data-nav="about"]').getAttribute('aria-current') === 'page');
T.check('extract no longer current', !$('[data-nav="extract"]').hasAttribute('aria-current'));
T.note('h1: ' + txt('#view-about h1'));

T.section('Extract one document, in 中文');
await w.handle([fixtureFile('packaged.docx', 'lesson-3.docx')]);
T.check('listing rendered', $$('.row').length > 0, $$('.row').length + ' rows');
T.check('one result card', $$('.found').length === 1);
T.check('filename came from the Packager header', txt('.found-name') === 'voice-memo.mp3');
T.check('no per-document heading for a single file', $$('.doc-head').length === 0);
T.check('progress line hidden when finished', $('#busy').hidden);

const note = $$('.row').find(r => r.dataset.v === 'hit').querySelector('.row-note').textContent;
T.note('zh: ' + note);
T.check('note is Chinese', /音频起始于.*定位方式/.test(note));
// A Latin value must not butt straight against a Han character.
T.check('no Han/Latin collision', !/[\u4e00-\u9fff]Packager/.test(note));
T.check('save button Chinese', txt('.save') === '保存 MP3');

T.section('Switching language keeps the results');
click('.langswitch button[data-lang="en"]');
const note2 = $$('.row').find(r => r.dataset.v === 'hit').querySelector('.row-note').textContent;
T.note('en: ' + note2);
T.check('card survives', $$('.found').length === 1);
T.check('note re-rendered in English', /Audio starts at/.test(note2));
T.check('save button English', txt('.save') === 'Save MP3');
T.check('filename unchanged', txt('.found-name') === 'voice-memo.mp3');

T.section('A file that is not a document');
await w.handle([{ name: 'notes.txt', size: 8,
                  arrayBuffer: async () => new Uint8Array([1,2,3,4,5,6,7,8]).buffer }]);
T.check('empty state shown', !!$('.empty'));
T.check('no result cards', $$('.found').length === 0);
T.note(txt('.empty p'));

T.done();
