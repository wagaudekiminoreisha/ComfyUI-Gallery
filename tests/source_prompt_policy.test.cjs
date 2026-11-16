const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');
const {filterSourceCategories,SOURCE_PRESETS}=load('SourceTagPolicy');
const {sourcePrompt,promptSourceImages}=load('ImageSourceGeometry');
const {filteredSourceText,sourceExclusionPayload}=load('SourceExclusions');const B=load('PromptBoxes');
test('transfer distinctions separate motion, camera, skin state and palette without broad topic removal',()=>{
 const text='sitting, running, arms up, blue eyes, closed eyes, looking at viewer, freckles, wet, forest, rain, night, monochrome, lineart, sword, cat, unknown';
 assert.equal(filterSourceCategories(text,['pose-motion','skin-body-surface','background-weather','art-palette']).text,'sitting, arms up, blue eyes, closed eyes, looking at viewer, freckles, forest, night, lineart, sword, cat, unknown');
 assert.equal(filterSourceCategories('blue eyes, closed eyes, looking at viewer',['eyes-colour']).text,'closed eyes, looking at viewer');
 assert.equal(filterSourceCategories('sword, cat, tree, hug',['props-interaction-objects']).text,'cat, tree, hug');
});
test('fine attire filters overlap deliberately and parent clothing includes every child',()=>{
 const text='white shirt, blue skirt, armor, casual, sneakers, mysterious garment';
 assert.equal(filterSourceCategories(text,['clothing-tops']).text,'blue skirt, armor, casual, sneakers, mysterious garment');
 assert.equal(filterSourceCategories(text,['clothing-bottoms','clothing-armor']).text,'white shirt, casual, sneakers, mysterious garment');
 assert.equal(filterSourceCategories(text,['clothing-casual-style']).text,'white shirt, blue skirt, armor, sneakers, mysterious garment');
 assert.equal(filterSourceCategories(text,['clothing']).text,'mysterious garment');
});
test('source-local category masks preserve unknowns, weights and optional probability',()=>{
 assert.equal(filterSourceCategories('long hair, blue eyes, black dress, standing, arms up, from behind, unknown',SOURCE_PRESETS.pose).text,'standing, arms up, from behind, unknown');
 assert.equal(filterSourceCategories('long hair, standing, from behind',SOURCE_PRESETS.appearance).text,'long hair');
 assert.equal(filterSourceCategories('({blue eyes|standing|green eyes}:1.2), [long hair], smile',['hair','eyes']).text,'({|standing|}:1.2), smile');
});
test('batch prompt selection and consensus are independent of composition',()=>{
 const manifest={version:1,layout:'single',active_index:0,batch_indices:[1,2],images:[{input_name:'a',prompt:{positive:'standing, blue eyes'}},{input_name:'b',prompt:{positive:'sitting, blue eyes'}},{input_name:'c',prompt:{positive:'kneeling, blue eyes'}}]};
 assert.equal(sourcePrompt(manifest,'positive'),'standing, blue eyes');
 const batch={...manifest,prompt_selection:'batch',prompt_merge:'common'};
 assert.equal(sourcePrompt(batch,'positive'),'blue eyes');assert.deepEqual(promptSourceImages(batch).map(image=>image.input_name),['b','c']);
});
test('per-image edits feed consensus before source-local category filtering and survive reload',()=>{
 const box={...B.sourceBox(),categoryExclusions:['pose'],excludedBySource:{'a': ['blue eyes']}};
 const segments=[{key:'a',name:'a',text:'blue eyes, standing'},{key:'b',name:'b',text:'blue eyes, sitting'}];
 const merge={mode:'common',min_percent:60};
 assert.equal(filteredSourceText(box,segments,'',merge),'');
 const payload=sourceExclusionPayload(box,segments,merge);assert.deepEqual(payload.merge,merge);assert.deepEqual(payload.category_exclusions,['pose']);
 assert.deepEqual(B.parseState(JSON.parse(JSON.stringify({version:1,boxes:[box]}))).boxes[0].categoryExclusions,['pose']);
});
