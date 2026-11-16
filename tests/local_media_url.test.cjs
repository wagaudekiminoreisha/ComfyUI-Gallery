const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const {localMediaUrl}=load('LocalMediaUrl');
const {collectSessionOutputs,sessionOutputFile}=load('SessionOutputCollection');
test('reused output filenames get distinct request URLs without changing identity',()=>{
 const file={url:'/static_gallery/run/a%20b.png',timestamp:1,revision:'old'};
 const first=localMediaUrl(file,'root one');
 assert.notEqual(first,localMediaUrl({...file,revision:'new'},'root one'));
 assert.notEqual(first,localMediaUrl(file,'root two'));
 assert.equal(file.url,'/static_gallery/run/a%20b.png');
 assert.equal(localMediaUrl(file,'root one'),first);
});
test('view requests keep their existing parameters and remote content hashes are unchanged',()=>{
 const url=localMediaUrl({url:'/view?filename=a.png&subfolder=previews&type=temp',timestamp:2});
 const params=new URLSearchParams(url.split('?')[1]);assert.equal(params.get('filename'),'a.png');assert.equal(params.get('type'),'temp');assert(params.get('gallery_revision'));
 const remote='/Gallery/hydrus/original?hash=abc';assert.equal(localMediaUrl({url:remote,timestamp:1}),remote);
});
test('new execution revisions survive merging with a stale indexed file and refresh on reuse',()=>{
 const event={images:[{filename:'reuse.png'}]};
 const old=collectSessionOutputs([],event,1000)[0],fresh=collectSessionOutputs([],event,2000)[0];
 const indexed={...old,metadata:{prompt:'indexed metadata'}};
 const merged=sessionOutputFile(fresh,indexed);
 assert.equal(merged.metadata,indexed.metadata);assert.equal(merged.timestamp,2);
 assert.notEqual(localMediaUrl(merged),localMediaUrl(indexed));
 assert.equal(sessionOutputFile(old,{...indexed,timestamp:3,revision:'disk-new'}).revision,'disk-new');
});
