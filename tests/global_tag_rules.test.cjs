const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs');
const {reviewGlobalTags,assessTagOccurrences,globalTagKnowledge,GLOBAL_TAG_PACK}=load('GlobalTagRules');
const {promptRuleOccurrences}=load('PromptRuleContext');
const checks=(text,bindings)=>reviewGlobalTags(text,bindings).findings.filter(item=>item.level==='check');

test('global pack spans independent domains and contains no enforcement policy',()=>{
 assert(GLOBAL_TAG_PACK.facets.length>=75);assert(GLOBAL_TAG_PACK.rules.length>=45);
 assert(GLOBAL_TAG_PACK.rules.every(rule=>rule.policy!=='enforce'&&rule.status==='candidate'));
 for(const domain of ['hair','eyes','body','pose','clothes','count','composition','scene','light','art','text','objects'])assert(GLOBAL_TAG_PACK.facets.some(f=>f.id.startsWith(domain+'.')),domain);
});
test('primary values warn without treating hierarchical lengths or independent facets as exclusive',()=>{
 assert(checks('short hair, long_hair').some(item=>item.ruleId==='hair.length.values'));
 assert.equal(checks('long hair, very long hair').length,0);
 assert.equal(checks('blonde hair, long hair, sidelocks').length,0);
 assert.equal(checks('smile, crying').length,0);
 assert.equal(checks('shirt, jacket, skirt, pants, tights').length,0,'layering belongs to contextual clothing review');
 assert(globalTagKnowledge('blonde hair','short hair').length);
 assert.deepEqual(globalTagKnowledge('unknown_a','unknown_b'),[]);
});
test('multiple hair, eye and garment colours remain compatible',()=>{
 for(const text of ['blonde hair, brown hair','blue eyes, green eyes','blue skirt, red skirt']){
  const review=reviewGlobalTags(text);assert.equal(checks(text).length,0,text);
  assert(review.findings.some(item=>item.level==='compatible'),text);
 }
 assert.equal(checks('blue eyes, green eyes, heterochromia').length,0);
});
test('branch-local review handles complete outfit alternatives and optional combinations',()=>{
 for(const text of ['{blonde hair, short hair|blonde hair, long hair}','{standing|sitting}','{long sleeves|sleeveless}','{indoors|outdoors}'])assert.equal(checks(text).length,0,text);
 for(const text of ['{standing|}, {sitting|}','{(standing, sitting)|}','standing, {sitting|lying}'])assert(checks(text).some(item=>item.ruleId==='pose.support.values'),text);
 assert.equal(checks('({standing|sitting}:1.2)').length,0);
});
test('scope bindings separate people, garments, panels and regions',()=>{
 for(const [text,key] of [['standing, sitting','subject'],['long sleeves, sleeveless','garment'],['full body, upper body','view'],['short hair, long hair','region'],['day, night','scene']]){
  assert.equal(checks(text,{'root/0':{[key]:'a'},'root/1':{[key]:'b'}}).length,0,text);
 }
 const known={subject:'person',region:'scalp',frame:'now'};
 assert.equal(checks('short hair, long hair',{'root/0':known,'root/1':known})[0].scope,'known');
 assert.equal(checks('short hair, long hair')[0].scope,'unknown');
});
test('context exceptions are guaranteed in the matching branch and cannot leak to another person',()=>{
 assert.equal(checks('short hair, long hair, short hair with long locks').length,0);
 assert.equal(checks('standing, sitting, multiple views').length,0);
 assert(checks('standing, sitting, {multiple views|}').length);
 assert(checks('{standing, sitting, multiple views|standing, sitting}').length);
 assert.equal(checks('sitting, kneeling, seiza').length,0);
 assert(checks('standing, lying, seiza').length,'a specialised seat cannot waive unrelated poses');
 const bound={subject:'person',region:'scalp',frame:'now'};
 assert(checks('short hair, long hair, short hair with long locks',{'root/0':bound,'root/1':bound,'root/2':bound}).length,'a context hint cannot override explicit identical bindings');
 const parsed=promptRuleOccurrences('short hair, long hair, short hair with long locks');
 parsed.occurrences[0].scope={subject:'a'};parsed.occurrences[1].scope={subject:'a'};parsed.occurrences[2].scope={subject:'b'};
 assert(assessTagOccurrences(parsed.occurrences).findings.some(item=>item.level==='check'));
});
test('solo with mixed counts is a three-occurrence rule, not a ban on the two counts',()=>{
 const mixed=checks('solo, 1girl, 1boy').find(item=>item.ruleId==='count.solo-mixed');
 assert(mixed);assert.equal(mixed.paths.length,3);
 assert.equal(checks('1girl, 1boy').length,0);
 assert.equal(checks('solo, {1girl|1boy}').length,0);
 assert.equal(checks('solo, 1girl, 1boy, multiple views').length,0);
 assert(checks('solo, 2girls').some(item=>item.ruleId==='count.solo-girls'));
 assert(checks('1girl, 2girls').some(item=>item.ruleId==='count.girls.values'));
});
test('pose, crop, time and clothing attributes share one scoped evaluator',()=>{
 for(const [text,rule] of [['standing, lying','pose.support.values'],['on back, on stomach','pose.lying-direction.values'],['open mouth, closed mouth','mouth.openness.values'],['full body, upper body','composition.crop.values'],['from above, from below','composition.elevation.values'],['day, night','scene.time.values'],['indoors, outdoors','scene.location.values'],['long sleeves, short sleeves','clothes.sleeve-length.values']])assert(checks(text).some(item=>item.ruleId===rule),text);
 assert.equal(checks('indoors, outdoors, window').length,0);
 assert.equal(checks('bald, long hair, wig').length,0);
 assert(checks('bald, long hair').some(item=>item.ruleId==='hair.absent-length'));
});
test('unknown terms remain unknown and aliases use only the pinned unambiguous mapping',()=>{
 const review=reviewGlobalTags('unlisted magic tag, long hair');assert(review.unknown.includes('unlisted_magic_tag'));
 assert.deepEqual(reviewGlobalTags('constructor, __proto__').unknown,['constructor','__proto__']);
 const alias=Object.entries(GLOBAL_TAG_PACK.aliases).find(([a,b])=>a!==b&&b==='1girl');assert(alias);
 assert.equal(reviewGlobalTags(alias[0]).recognized,1);
});
test('large and deeply nested expressions report incomplete coverage',()=>{
 assert.equal(reviewGlobalTags('standing,'.repeat(5000)).incomplete,true);
 assert.equal(reviewGlobalTags('{'.repeat(40)+'standing|sitting'+'|}'.repeat(40)).incomplete,true);
 assert.equal(reviewGlobalTags(Array.from({length:250},()=>'{short hair|long hair}').join(', ')).incomplete,true);
});
