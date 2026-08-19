/**
 * Audio kept on the device between visits.
 *
 * The failure this guards against is silent: a student extracts her lesson,
 * closes the tab, comes back, and it is gone. Or worse, comes back and finds
 * four copies of it. So the assertions read the database directly rather than
 * asking the page what it thinks it stored, and the "next visit" is a second
 * window over the same store, which is what a reload actually is.
 *
 * fake-indexeddb stands in for the browser's store. Every other suite runs
 * without one, which covers the other path that matters: the page has to work
 * where storage is missing or refused.
 */
import fakeIndexedDB from 'fake-indexeddb';
import { makeWindow, fixtureFile, runner, PAYLOAD_BYTES } from './helpers.mjs';

const T = runner('Kept audio');

const settle = () => new Promise(r => setTimeout(r, 20));
const $  = (w, s) => w.document.querySelector(s);
const $$ = (w, s) => [...w.document.querySelectorAll(s)];
const txt = (w, s) => ($(w, s) ? $(w, s).textContent.trim() : '(missing)');

/** Read the store from outside the page, so this checks what actually landed. */
function stored() {
  return new Promise((resolve, reject) => {
    const req = fakeIndexedDB.open('unwrap', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction('audio', 'readonly').objectStore('audio').getAll();
      get.onsuccess = () => { resolve(get.result); db.close(); };
      get.onerror = () => { reject(get.error); db.close(); };
    };
  });
}

T.section('Extracting keeps a copy');
const { w: a } = makeWindow({ indexedDB: fakeIndexedDB });
await a.handle([fixtureFile('packaged.docx', 'lesson-1.docx')]);
await settle();

let recs = await stored();
T.check('one record stored', recs.length === 1, recs.length + '');
T.check('audio stored as bytes, not re-encoded', recs[0].data.length === PAYLOAD_BYTES,
        recs[0].data.length + ' bytes');
T.check('id names the document and the file',
        recs[0].id.includes('lesson-1.docx') && recs[0].id.includes('voice-memo.mp3'));
T.check('not listed as kept while it is on screen', $(a, '#kept').hidden);

T.section('Next visit');
const { w: b } = makeWindow({ indexedDB: fakeIndexedDB });
await settle();
T.check('kept section shown', !$(b, '#kept').hidden);
T.check('one card', $$(b, '#keptCards .found').length === 1);
T.check('filename survived', txt(b, '#keptCards .found-name') === 'voice-memo.mp3');
T.check('document it came from survived', txt(b, '#keptCards .found-doc') === 'lesson-1.docx');
T.check('it can be played', !!$(b, '#keptCards .play') && !!$(b, '#keptCards audio'));
T.check('it can still be saved', !!$(b, '#keptCards .save'));
T.check('count reads right', txt(b, '#keptMeta') === '1 kept from before', txt(b, '#keptMeta'));

T.section('Opening the same document again does not pile up copies');
await b.handle([fixtureFile('packaged.docx', 'lesson-1.docx')]);
await settle();
recs = await stored();
T.check('still one record', recs.length === 1, recs.length + '');
T.check('kept section stands down while it is on screen', $(b, '#kept').hidden);

T.section('A different document is kept alongside');
await b.handle([fixtureFile('ole10.docx', 'lesson-2.docx')]);
await settle();
recs = await stored();
T.check('two records now', recs.length === 2, recs.length + '');

T.section('Forgetting');
const { w: c } = makeWindow({ indexedDB: fakeIndexedDB });
await settle();
T.check('both kept from before', $$(c, '#keptCards .found').length === 2);

$(c, '.langswitch button[data-lang="zh"]').dispatchEvent(new c.Event('click'));
await settle();
T.check('kept cards follow the language', txt(c, '#keptMeta') === '之前保存的 2 个', txt(c, '#keptMeta'));
T.check('forget button translated', txt(c, '#forget') === '清除这些');

$(c, '#forget').dispatchEvent(new c.Event('click'));
T.check('one press only arms it', txt(c, '#forget') === '再按一次即清除');
T.check('nothing forgotten yet', (await stored()).length === 2);

$(c, '#forget').dispatchEvent(new c.Event('click'));
await settle();
T.check('second press forgets', (await stored()).length === 0);
T.check('section hidden afterwards', $(c, '#kept').hidden);

T.done();
