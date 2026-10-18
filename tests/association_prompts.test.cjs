const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./ts_loader.cjs');const {associationPrompts}=load('AssociationPrompts');
test('source association tags exclude encoder additions and retain both source polarities',()=>{
 const metadata={positive:'blue hair, manually added',negative:'blur, extra negative',prompt:{'1':{class_type:'GalleryImageSource',inputs:{sources:JSON.stringify({layout:'single',active_index:1,images:[{prompt:{positive:'unused image'}},{prompt:{positive:'blue hair',negative:'blur'}}]})}}}};
 assert.deepEqual(associationPrompts(metadata),{positive:'blue hair',negative:'blur'});
 assert(associationPrompts(metadata,false).positive.includes('manually added'));
});
test('ordinary imported images keep their own used prompt as source recipe',()=>assert.deepEqual(associationPrompts({positive:'green eyes',negative:'watermark'}),{positive:'green eyes',negative:'watermark'}));
