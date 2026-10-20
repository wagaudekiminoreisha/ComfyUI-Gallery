const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs'),R=load('RuleEngine');
const definition=require('../data/prompt-rulesets.json').definitions.find(row=>row.id==='stock-attire-styling');
const box=(preferences={})=>({id:'attire',definition,scope:'main',origin:'encoder',preferences,enabled:true,collapsed:false});
const apply=(text,prefs)=>R.applyRulePreview(text,[box(prefs)]);
test('attire permits accessories with garments and checks only co-active conflicting bottoms',()=>{
 assert.deepEqual(apply('jeans, hairpin').errors,[]);
 assert(apply('jeans, track pants').errors.length);
 assert.deepEqual(apply('{jeans|track pants}, {hairpin|hair ribbon|}').errors,[]);
 assert.deepEqual(apply('{jeans, hairpin|track pants, headband}').errors,[]);
 assert(apply('{jeans|}, {track pants|}').errors.length,'independent optional bottoms can coincide');
});
test('garment ancestors and subtypes do not count as competing garments',()=>{
 for(const text of ['pants, jeans','pants, track pants','skirt, pleated skirt','shorts, denim shorts','dress, sundress'])assert.deepEqual(apply(text).errors,[],text);
 assert(apply('pants, skirt').errors.length);
});
test('layering is explicit and never permits two competing trouser types',()=>{
 assert(apply('jeans, skirt').errors.length);
 for(const text of ['jeans, skirt','track pants, skirt','leggings, skirt','jeans, dress'])assert.deepEqual(apply(text,{bottoms:'layered'}).errors,[],text);
 assert(apply('jeans, track pants, skirt',{bottoms:'layered'}).errors.length);
 assert.deepEqual(apply('jeans, track pants',{bottoms:'multiple'}).errors,[]);
});
test('outfit recipes remove competing bottoms and preserve unrelated styling',()=>{
 const result=apply('track pants, jeans, skirt, hairpin, blue eyes',{bottoms:'skirt-jeans'});
 assert.deepEqual(result.errors,[]);assert.equal(result.text,'jeans, skirt, hairpin, blue eyes');
 const single=apply('track pants, skirt, hairclip',{bottoms:'jeans'});
 assert.equal(single.text,'hairclip, jeans');
});
test('separate upper and outer slots allow layering; hair accessories combine with headwear',()=>{
 const result=apply('blue eyes',{base:'blouse',outer:'cardigan',headwear:'beret','hair-accessories':'pins-ribbon'});
 for(const term of ['blouse','cardigan','beret','hairpin','hair_ribbon'])assert(result.text.includes(term));
 assert.deepEqual(result.errors,[]);
});
test('hair interaction cleanup leaves hair attributes and worn accessories intact',()=>{
 const text='long hair, hairpin, hairclip, holding own hair, knife in hair, prehensile hair, hair through hood, blue eyes';
 const result=apply(text,{'hair-interactions':'both'});
 assert.equal(result.text,'long hair, hairpin, hairclip, blue eyes');assert.deepEqual(result.errors,[]);
 assert.equal(apply(text).text,text);
});
