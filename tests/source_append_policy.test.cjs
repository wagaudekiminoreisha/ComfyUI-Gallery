const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const P=load('SourceAppendPolicy');const {sourcePrefixRecipe}=load('SourcePrefixes');
const h='a'.repeat(64),other='b'.repeat(64);
const image=(path,metadata={})=>({input_name:path,metadata});
const recipe=(id,snapshot_id)=>({id,name:id,snapshot_id,positive:[id+' tag'],negative:[id+' negative']});
const row=(prefixes,metadata={},associatedIds=prefixes.map(p=>p.id))=>({prefixes,metadata,associatedIds,positive:prefixes.flatMap(p=>p.positive),negative:prefixes.flatMap(p=>p.negative),usePositive:true,useNegative:false,tags:['local tag'],sync:false});
test('image identity uses content, not prefix, title or ancestry',()=>{
 assert(P.sameSourceImage(image('gallery_sources/'+h+'.png'),image('hydrus/'+h+'.jpg')));
 assert(P.sameSourceImage(image('gallery_sources/'+h+'.png',{gallery_content_hash:other}),image('hydrus/'+h+'.jpg')));
 assert(!P.sameSourceImage(image('gallery_sources/'+h+'.png',{gallery_url:'/same.png'}),image('gallery_sources/'+other+'.png',{gallery_url:'/same.png'})));
 assert(P.sameSourceImage(image('a\\b.png'),image('a/b.png')));
 assert(!P.sameSourceImage(image('a.png',{gallery_prefix:recipe('p')}),image('b.png',{gallery_prefix:recipe('p')})));
 assert(!P.sameSourceImage(image('a.png',{gallery_url:'/a.png',gallery_root:'one'}),image('b.png',{gallery_url:'/a.png',gallery_root:'two'})));
 assert(!P.sameSourceImage(image('a.png',{gallery_url:'/a.png',gallery_revision:'1'}),image('b.png',{gallery_url:'/a.png',gallery_revision:'2'})));
});
test('duplicates in the target and within a batch are skipped without replacing existing settings',()=>{
 const existing={...image('gallery_sources/'+h+'.png'),output_slot:5,crop:{x:0,y:0,width:.5,height:1},prompt:{positive:'keep',negative:'',tags:[]}};
 const state=JSON.stringify(existing),a=image('hydrus/'+h+'.png'),b=image('new.png'),c=image('new.png');
 const result=P.partitionSourceAppend([existing],[a,b,c]);assert.deepEqual(result.accepted,[b]);assert.equal(result.duplicates.length,2);assert.strictEqual(result.duplicates[0].existing,existing);assert.equal(JSON.stringify(existing),state);
 const full=Array.from({length:32},(_,i)=>image('item'+i+'.png'));assert.equal(P.partitionSourceAppend(full,[full[0],full[31]]).accepted.length,0);
});
test('common prefixes reuse only compatible snapshot choices and preserve unrelated selections and edits',()=>{
 const donor=row([recipe('pose','new'),recipe('character','secret')]);donor.useNegative=true;
 const target=row([recipe('pose','old'),recipe('lighting')]);target.positive.push('individual edit');const frozen=JSON.stringify(target);
 const result=P.reuseAppendConfiguration(donor,target);assert.deepEqual(result.prefixes.map(p=>[p.id,p.snapshot_id]),[['lighting',undefined],['pose','new']]);assert(result.positive.includes('individual edit'));assert(!result.prefixes.some(p=>p.id==='character'));assert.deepEqual(result.tags,['local tag']);assert.equal(JSON.stringify(target),frozen);
});
test('shared provenance permits a recipe on a related image, but unrelated images remain untouched',()=>{
 const donor=row([recipe('pose','snapshot')],{gallery_content_hash:h});
 const target=row([],{gallery_append_provenance:{hashes:[h],snapshots:[]}});
 assert.equal(P.reuseAppendConfiguration(donor,target).prefixes[0].snapshot_id,'snapshot');
 const unrelated=row([recipe('other')]);assert.strictEqual(P.reuseAppendConfiguration(donor,unrelated),unrelated);
 const sameSnapshot=row([],{gallery_append_provenance:{hashes:[],snapshots:['shared']}});
 donor.metadata={gallery_append_provenance:{hashes:[],snapshots:['shared']}};assert.equal(P.reuseAppendConfiguration(donor,sameSnapshot).prefixes[0].id,'pose');
});
test('deselected shared prefixes and disabled sides are carried without enabling unrelated sides',()=>{
 const donor=row([recipe('pose','new')],{},['pose','character']);donor.usePositive=false;donor.useNegative=true;
 const target=row([recipe('pose','old'),recipe('character')]);
 const result=P.reuseAppendConfiguration(donor,target);assert.deepEqual(result.prefixes.map(p=>p.id),['pose']);assert.equal(result.usePositive,false);assert.equal(result.useNegative,true);assert.equal(result.prefixes[0].positive_enabled,false);
});
test('snapshot choices stay bound to their own prefix',()=>{
 const library={version:2,tags:[],prefixes:[{id:'pose',name:'Pose',tags:[]}],snapshots:{wrong:{id:'wrong',prefix_id:'character',terms:['wrong terms'],negative_terms:[]}}};assert.equal(sourcePrefixRecipe(library,'pose','wrong'),undefined);
});

test('partial sharing preserves unrelated enabled sides without re-enabling the copied disabled side',()=>{
 const donor=row([recipe('pose','new')]);donor.usePositive=false;
 const target=row([recipe('pose','old'),recipe('lighting')]);const result=P.reuseAppendConfiguration(donor,target);
 assert.equal(result.usePositive,true);assert.equal(result.prefixes.find(ref=>ref.id==='pose').positive_enabled,false);assert.deepEqual(result.positive,['lighting tag']);
});
