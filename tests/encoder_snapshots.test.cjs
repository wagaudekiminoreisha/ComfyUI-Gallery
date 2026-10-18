const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../web/node_modules/typescript');
const {load}=require('./ts_loader.cjs');
const filename=path.resolve(__dirname,'../web/src/EncoderSnapshots.ts');
const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function capture(positive,negative,excluded=[],excludedBySource,sourceKey='a.png:positive'){
 const payloads=[],module={exports:{}};
 const library={prefixes:[{id:'p',name:'Portrait',tags:[]}],tags:[]};
 vm.runInThisContext(`(function(exports,module,require){${source}\n})`,{filename})(module.exports,module,request=>request==='./PrefixLibrary'?{loadPrefixes:async()=>library,capturePrefixSnapshot:async payload=>{payloads.push(payload);return null;}}:load(request));
 const node={};const state={boxes:[{kind:'source',enabled:true,excluded,excludedBySource}],hairPolicy:{mode:'specific'}};
 const refs=await module.exports.preparePrefixSnapshots(node,state,{snapshotTargets:[{sourceKey,prefixId:'p',terms:positive,negative_terms:negative}]},[]);
 return {payload:payloads[0],refs,node};
}
test('image-source snapshots omit empty negative sides and trailing separators',async()=>{
 const {payload,refs}=await capture([' blonde hair ',''],['']);
 assert.deepEqual(payload.terms,['blonde hair']);assert.deepEqual(payload.negative_terms,[]);
 assert.deepEqual(refs[0].negative_terms,[]);
});
test('excluding all source tags captures an empty positive list',async()=>{
 const {payload}=await capture(['blonde hair'],[' '],['blonde hair']);
 assert.deepEqual(payload.terms,[]);assert.deepEqual(payload.negative_terms,[]);
});
test('optional alternatives retain their empty choices',async()=>{
 const {payload}=await capture(['{blonde hair|}',''],['{blurry|}','']);
 assert.deepEqual(payload.terms,['{blonde hair|}']);assert.deepEqual(payload.negative_terms,['{blurry|}']);
});

test('snapshots apply only the matching source image exclusions',async()=>{
 const map={'a.png:positive':['blue eyes']};
 const a=await capture(['blue eyes','blonde hair'],[],[],map,'a.png:positive');
 const b=await capture(['blue eyes','long hair'],[],[],map,'b.png:positive');
 assert.deepEqual(a.payload.terms,['blonde hair']);assert.deepEqual(b.payload.terms,['blue eyes','long hair']);
});
