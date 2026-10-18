const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs');
const {filterHairPrompt,cleanHairPolicy,hairWarnings}=load('HairPolicy');
const B=load('PromptBoxes');
for(const fixture of require('./hair_policy_cases.json')) test('hair policy: '+fixture.text,()=>assert.equal(filterHairPrompt(fixture.text,cleanHairPolicy(fixture.policy)),fixture.expected));
test('hair controls persist without removing original chips and survive external text edits',()=>{
 const state={...B.stateFromText('long hair, blue eyes'),hairPolicy:{mode:'natural',attributes:['length']}};
 const restored=B.parseState(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.hairPolicy.mode,'natural');assert.match(B.compileBoxes(restored),/long hair/);
 assert.equal(B.reconcileText(restored,'brown hair','boxes',false).hairPolicy.mode,'natural');
 assert.equal(cleanHairPolicy({mode:'invalid',attributes:['invalid']}).mode,'specific');
});
test('hair warnings respect branches, colour families, and intentional mixed colour',()=>{
 const single={mode:'specific',attributes:[],singleColour:true};
 assert(hairWarnings('blonde hair, brown hair',single).some(s=>s.startsWith('Single-colour')));
 for(const text of ['{blonde hair|brown hair}','blue hair, light blue hair'])assert(!hairWarnings(text,single).some(s=>s.startsWith('Single-colour')),text);
 assert(!hairWarnings('blonde hair, brown hair').some(s=>s.startsWith('Single-colour')));
 assert(hairWarnings('2girls, blonde hair, brown hair').some(s=>s.startsWith('Multiple subjects')));
 assert(!hairWarnings('{2girls, blonde hair|solo, brown hair}').some(s=>s.startsWith('Multiple subjects')));
 assert(hairWarnings('fiery_hair').some(s=>s.startsWith('Hair material')));
 assert(hairWarnings('highlights').some(s=>s.startsWith('Ambiguous')));
});

test('hair summary counts recognised template terms rather than deleting saved chips',()=>{
 const {hairFilterSummary}=load('HairPolicy');
 const summary=hairFilterSummary('long hair, {blonde hair|brown hair}, sidelocks, hair bow, beard',{mode:'minimal',attributes:['length']});
 assert.deepEqual(summary.retained,['long_hair']);
 assert.deepEqual(summary.omitted,['blonde_hair','brown_hair','sidelocks']);
 assert.equal(summary.incomplete,false);
});
