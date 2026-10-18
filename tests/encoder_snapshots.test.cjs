const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('../web/node_modules/typescript');
const {load}=require('./ts_loader.cjs');
const filename=path.resolve(__dirname,'../web/src/EncoderSnapshots.ts');
const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function capture(positive,negative,excluded=[]){
 const payloads=[],module={exports:{}};
 const library={prefixes:[{id:'p',name:'Portrait',tags:[]}],tags:[]};
 vm.runInThisContext(`(function(exports,module,require){${source}\n})`,{filename})(module.exports,module,request=>request==='./PrefixLibrary'?{loadPrefixes:async()=>library,capturePrefixSnapshot:async payload=>{payloads.push(payload);return null;}}:load(request));
 const node={};const state={boxes:[{kind:'source',enabled:true,excluded}],hairPolicy:{mode:'specific'}};
 const refs=await module.exports.preparePrefixSnapshots(node,state,{snapshotTargets:[{prefixId:'p',terms:positive,negative_terms:negative}]},[]);
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
