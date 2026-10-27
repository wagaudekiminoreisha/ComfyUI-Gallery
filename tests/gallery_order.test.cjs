const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../web/node_modules/typescript');
const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../web/src/GalleryOrder.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const compiled = { exports: {} };
vm.runInThisContext(`(function(exports,module){${source}\n})`)(compiled.exports, compiled);
const { orderGallery } = compiled.exports;
const entries = [{ id: 'local:a', date: 3, hash: undefined, mime: 'png' }, { id: 'hydrus:b', date: 2, hash: 'bbb', mime: 'jpg' }, { id: 'local:c', date: 1, hash: 'aaa', mime: 'webp' }];
test('mixed dates interleave sources without mutating input', () => { assert.deepEqual(orderGallery(entries, 'date', true, 1).map(x => x.id), ['local:c', 'hydrus:b', 'local:a']); assert.equal(entries[0].id, 'local:a'); });
test('missing hash always sorts last', () => { for (const asc of [true, false]) assert.equal(orderGallery(entries, 'hash', asc, 1).at(-1).id, 'local:a'); });
test('random is stable through selection updates and changes on reshuffle', () => { const many=Array.from({length:100},(_,i)=>({id:'file:'+i})); assert.deepEqual(orderGallery(many,'random',false,5),orderGallery(many,'random',false,5)); assert.notDeepEqual(orderGallery(many,'random',false,5),orderGallery(many,'random',false,6)); });
test('search order preserves Hydrus server order', () => assert.deepEqual(orderGallery(entries, 'result', false, 1), entries));

test('matching copies share Hydrus import time, unlinked files fall back to file time', () => {
 const { galleryDate } = compiled.exports;
 assert.equal(galleryDate({file_services:{current:{local:{time_imported:100}}}},200),100);
 assert.equal(galleryDate({time_imported:80,file_services:{current:{local:{time_imported:100}}}}),100);
 assert.equal(galleryDate({},200),200);
 assert.equal(galleryDate({time_imported:NaN}),undefined);
});

test('paginated random order appends new shuffled files without moving existing positions',()=>{
 const {extendRandomGallery}=compiled.exports;
 const rows=Array.from({length:300},(_,i)=>({id:'hydrus:'+i,date:i}));
 const first=extendRandomGallery(rows.slice(0,100),8);
 const second=extendRandomGallery(rows.slice(0,200),8,first.map(row=>row.id));
 const third=extendRandomGallery(rows,8,second.map(row=>row.id));
 assert.deepEqual(second.slice(0,100),first);assert.deepEqual(third.slice(0,200),second);
 assert.equal(new Set(third.map(row=>row.id)).size,300);
 assert.notDeepEqual(second.slice(100),rows.slice(100,200),'incoming batch is shuffled too');
 assert.notDeepEqual(extendRandomGallery(rows,9),third,'a fresh seed reshuffles all loaded files');
});
test('random extension refreshes metadata and drops removed files without rearranging survivors',()=>{
 const {extendRandomGallery}=compiled.exports;
 const old=extendRandomGallery(entries,8),removed=old[1].id;
 const updated=entries.filter(row=>row.id!==removed).map(row=>({...row,date:500}));
 const next=extendRandomGallery(updated,8,old.map(row=>row.id));
 assert.deepEqual(next.map(row=>row.id),old.filter(row=>row.id!==removed).map(row=>row.id));
 assert(next.every(row=>row.date===500));
});
