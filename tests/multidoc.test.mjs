/**
 * Many documents at once.
 *
 * The real-world shape of this: a folder of lesson attachments, several of which
 * contain an identically-named audio file. If the ZIP bundling doesn't
 * disambiguate, entries silently overwrite each other and the user gets fewer
 * files than the page promised — which is why the collision case is tested
 * through the actual button rather than by calling uniqueName() directly.
 */
import JSZip from 'jszip';
import { makeWindow, fixtureFile, runner, PAYLOAD_BYTES } from './helpers.mjs';

const { w, blobs } = makeWindow();
const T = runner('Multiple documents');

const $  = s => w.document.querySelector(s);
const $$ = s => [...w.document.querySelectorAll(s)];
const txt = s => ($(s) ? $(s).textContent.trim() : '(missing)');

T.section('Input accepts a selection, not a single file');
T.check('multiple attribute set', w.document.getElementById('file').hasAttribute('multiple'));

T.section('One document keeps the UI quiet');
await w.handle([fixtureFile('packaged.docx', 'lesson-1.docx')]);
T.check('one card', $$('.found').length === 1);
T.check('no per-document headings', $$('.doc-head').length === 0);
T.check('no bundle button', $('#saveAll').hidden);
T.check('no source label on the card', !$('.found-doc'));
T.check('count reads "1 file"', txt('#resMeta') === '1 file', txt('#resMeta'));

T.section('Four documents at once');
const revokedBefore = blobs.revoked;
await w.handle([
  fixtureFile('packaged.docx',    'lesson-1.docx'),
  fixtureFile('ole10.docx',       'lesson-2.docx'),
  fixtureFile('plain_media.docx', 'lesson-3.docx'),   // this one holds two
  fixtureFile('raw_stream.docx',  'lesson-4.docx'),
]);
T.check('previous blob URLs released', blobs.revoked > revokedBefore, `${blobs.revoked} revoked`);
T.check('five cards', $$('.found').length === 5, $$('.found').length + '');
T.check('four document headings', $$('.doc-head').length === 4);
T.check('bundle button appears', !$('#saveAll').hidden);
T.check('count names both totals', txt('#resMeta') === '5 files from 4 documents', txt('#resMeta'));
T.check('every card labelled with its document', $$('.found-doc').length === 5);
T.note('headings: ' + $$('.doc-head').map(e => e.textContent.replace(/\s+/g, ' ')).join(' | '));
T.check('per-document count is right', /2/.test($$('.doc-head')[2].textContent));
T.check('players still above the listing',
  !!($('#results').compareDocumentPosition($('#trace')) & w.Node.DOCUMENT_POSITION_FOLLOWING));

T.section('A batch where one document has nothing');
await w.handle([
  fixtureFile('packaged.docx', 'good.docx'),
  { name: 'notes.txt', size: 8, arrayBuffer: async () => new Uint8Array([1,2,3,4,5,6,7,8]).buffer },
]);
T.check('both documents listed', $$('.doc-head').length === 2);
T.check('one card, from the good document', $$('.found').length === 1);
T.check('empty document marked',
  $$('.doc-head').some(h => /nothing found/.test(h.textContent)),
  $$('.doc-head').map(e => e.textContent.replace(/\s+/g, ' ')).join(' | '));

T.section('Bundle as ZIP with colliding filenames');
await w.handle([
  fixtureFile('packaged.docx', 'lesson-1.docx'),
  fixtureFile('packaged.docx', 'lesson-2.docx'),
  fixtureFile('packaged.docx', 'lesson-3.docx'),
]);
T.check('all three share a filename',
  $$('.found-name').every(e => e.textContent === 'voice-memo.mp3'));

// Drive the real button and capture what it hands to createObjectURL.
let zipBlob = null;
const prev = w.URL.createObjectURL;
w.URL.createObjectURL = (b) => { if (b && b.type === 'application/zip') zipBlob = b; return prev(b); };
$('#saveAll').dispatchEvent(new w.Event('click'));
for (let i = 0; i < 300 && !zipBlob; i++) await new Promise(r => setTimeout(r, 10));
T.check('a zip was produced', !!zipBlob);

const back = await JSZip.loadAsync(Buffer.from(await zipBlob.arrayBuffer()));
const names = Object.keys(back.files);
T.check('three entries', names.length === 3, names.join(', '));
T.check('names disambiguated', new Set(names).size === 3);
T.check('collision suffix applied', names.some(n => /\(2\)/.test(n)));
const first = await back.file(names[0]).async('uint8array');
T.check('contents round-trip byte-exact',
  first.length === PAYLOAD_BYTES && first[0] === 0x49 && first[1] === 0x44);
T.check('button restored afterwards', txt('#saveAll') === 'Save all as ZIP' && !$('#saveAll').disabled);

T.section('Language switch with a batch loaded');
$('.langswitch button[data-lang="zh"]').dispatchEvent(new w.Event('click'));
T.check('cards survive', $$('.found').length === 3);
T.check('count in Chinese', txt('#resMeta') === '来自 3 份文档的 3 个文件', txt('#resMeta'));
T.check('section title Chinese', txt('.sec-title') === '音频');
T.check('bundle button Chinese', txt('#saveAll') === '打包下载全部');
T.check('per-document count Chinese', /找到/.test($$('.doc-head')[0].textContent));
T.note('heading: ' + $$('.doc-head')[0].textContent.replace(/\s+/g, ' '));

T.done();
