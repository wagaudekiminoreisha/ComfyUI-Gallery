const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs');
const {findMetadataMatches}=load('MetadataSearch');
test('metadata search covers nested generation values, Hydrus notes and literal keys',()=>{
 const metadata={prompt:{12:{inputs:{text:'Long hair, SIDELocks'}}},hydrus:{notes:{generation:JSON.stringify({resolved:'blue hair'})},tags:['hair ornament']},seed:123};
 assert.deepEqual(findMetadataMatches(metadata,'sidelocks').matches,[{path:'prompt.12.inputs.text',text:'Long hair, SIDELocks'}]);
 assert.equal(findMetadataMatches(metadata,'blue hair').matches[0].path,'hydrus.notes.generation.resolved');
 assert.equal(findMetadataMatches(metadata,'seed').matches[0].text,'123');
 assert.equal(findMetadataMatches(metadata,'hair').total,3);
 assert.equal(findMetadataMatches(metadata,'[').total,1,'search characters are literal');
 assert.equal(findMetadataMatches(metadata,'missing').total,0);
});
test('metadata search bounds displayed results without changing its input',()=>{
 const metadata=Object.freeze({rows:Object.freeze(Array.from({length:250},(_,i)=>'tag '+i))});
 const result=findMetadataMatches(metadata,'tag');assert.equal(result.total,250);assert.equal(result.matches.length,200);
 assert.equal(findMetadataMatches(metadata,' ').total,0);
});
