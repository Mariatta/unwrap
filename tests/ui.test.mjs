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

T.section('Layout contract: audio on the first page, workings on their own');
const sections = [...w.document.getElementById('view-extract').querySelectorAll('section')].map(s => s.id);
T.check('results before kept', sections.indexOf('results') < sections.indexOf('kept'), sections.join(' → '));
T.check('the byte listing is not on the extract page', !sections.includes('trace'));
T.check('it lives on its own page', !!w.document.querySelector('#view-inside #trace'));
T.check('reachable by a link', !!w.document.querySelector('#view-extract .inside-link a'));

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

T.section("Routing to #/inside");
w.location.hash = '#/inside';
w.dispatchEvent(new w.Event('hashchange'));
T.check('inside visible', !w.document.getElementById('view-inside').hidden);
T.check('extract hidden', w.document.getElementById('view-extract').hidden);
T.check('about hidden', w.document.getElementById('view-about').hidden);
T.check('rows are there', $$('#view-inside .row').length > 0, $$('#view-inside .row').length + ' rows');
T.check('a way back', !!$('#view-inside .inside-link a'));
w.location.hash = '#/';
w.dispatchEvent(new w.Event('hashchange'));
T.check('and back again', !w.document.getElementById('view-extract').hidden);

T.section('The play button');
T.check('one big play button on the card', $$('.play').length === 1);
T.check('labelled with the filename', $('.play').getAttribute('aria-label') === 'Play voice-memo.mp3',
        $('.play').getAttribute('aria-label'));
T.check('native controls kept for scrubbing', !!$('.found audio[controls]'));

// jsdom implements neither play() nor pause(), so drive the element by event:
// what matters is that the button follows the media, whichever one started it.
$('.found audio').dispatchEvent(new w.Event('play'));
T.check('label flips to pause', $('.play').getAttribute('aria-label') === 'Pause voice-memo.mp3');
$('.found audio').dispatchEvent(new w.Event('pause'));
T.check('label returns to play', $('.play').getAttribute('aria-label') === 'Play voice-memo.mp3');
$('.found audio').dispatchEvent(new w.Event('play'));
$('.found audio').dispatchEvent(new w.Event('ended'));
T.check('reaching the end resets it', $('.play').getAttribute('aria-label') === 'Play voice-memo.mp3');

T.section('Playback speed, on the card');
T.check('three rates offered', $$('.speed button').length === 3,
        $$('.speed button').map(b => b.textContent).join(' '));
T.check('normal first, then slower ones',
        $$('.speed button').map(b => b.dataset.rate).join(',') === '1,0.75,0.5');
T.check('labelled in words, not multipliers',
        $$('.speed button').map(b => b.textContent).join(',') === 'Normal,Slow,Slower',
        $$('.speed button').map(b => b.textContent).join(','));
T.check('starts at normal speed', $('.speed button[data-rate="1"]').getAttribute('aria-pressed') === 'true');
T.check('the audio agrees', $('.found audio').playbackRate === 1);
T.check('group is labelled for a screen reader', $('.speed').getAttribute('aria-label') === 'Playback speed');
T.check('pitch is preserved, so slow speech is not a growl', $('.found audio').preservesPitch === true);

$('.speed button[data-rate="0.75"]').dispatchEvent(new w.Event('click'));
T.check('choosing 0.75 sets the player', $('.found audio').playbackRate === 0.75);
T.check('and defaultPlaybackRate, so a reload of the media keeps it',
        $('.found audio').defaultPlaybackRate === 0.75);
T.check('the control shows which is chosen', $('.speed button[data-rate="0.75"]').getAttribute('aria-pressed') === 'true');
T.check('and unshows the old one', $('.speed button[data-rate="1"]').getAttribute('aria-pressed') === 'false');
T.check('choice remembered', w.localStorage.getItem('unwrap.rate') === '0.75');

T.section('A file that is not a document');
await w.handle([{ name: 'notes.txt', size: 8,
                  arrayBuffer: async () => new Uint8Array([1,2,3,4,5,6,7,8]).buffer }]);
T.check('empty state shown', !!$('.empty'));
T.check('no result cards', $$('.found').length === 0);
T.note(txt('.empty p'));

T.section('A speed chosen last time is still chosen');
const { w: w2 } = makeWindow({ storage: { 'unwrap.rate': '0.5' } });
await w2.handle([fixtureFile('packaged.docx', 'lesson-9.docx')]);
const slow = w2.document.querySelector('.found audio');
T.check('player starts slowed', slow.playbackRate === 0.5, String(slow.playbackRate));
T.check('control shows it', w2.document.querySelector('.speed button[data-rate="0.5"]')
        .getAttribute('aria-pressed') === 'true');

T.done();
