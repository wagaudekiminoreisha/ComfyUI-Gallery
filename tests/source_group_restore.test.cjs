const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./ts_loader.cjs');
const {omittedSourceGroups,restoreAllSourceGroups}=load('SourceGroupRestore');

test('a removed nested group is restorable after its required parent collapses',()=>{
 const original='({{blue eyes|green eyes}|brown eyes}:1.2)';
 const [group]=omittedSourceGroups(original,'(brown eyes:1.2)');
 assert.equal(group.text,'{blue eyes|green eyes}');
 assert.equal(group.replacement,original);
 assert.deepEqual(omittedSourceGroups(original,group.replacement),[]);
});
test('restoration preserves optional parent settings and sibling edits',()=>{
 const original='({{blue eyes|green eyes}|brown eyes|long hair|}:1.2)';
 const [group]=omittedSourceGroups(original,'({amber eyes|short hair|}:1.4)');
 assert.equal(group.replacement,'({{blue eyes|green eyes}|amber eyes|short hair|}:1.4)');
});
test('restoration descends through surviving groups and preserves their changes',()=>{
 const original='{{{blue eyes|green eyes}|brown eyes|}|long hair}';
 const [group]=omittedSourceGroups(original,'{{brown eyes|}|short hair}');
 assert.equal(group.text,'{blue eyes|green eyes}');
 assert.equal(group.replacement,'{{{blue eyes|green eyes}|brown eyes|}|short hair}');
});
test('restore all restores multiple groups in source order without resetting sibling edits',()=>{
 const original='{{a|b}|{c|d}|tail|}';
 assert.equal(omittedSourceGroups(original,'{custom tail|}').length,2);
 assert.equal(restoreAllSourceGroups(original,'{custom tail|}'),'{{a|b}|{c|d}|custom tail|}');
});
test('a surviving nested group is not mistaken for a removed group when the outer group collapses',()=>{
 assert.deepEqual(omittedSourceGroups('{{a|b}|tail}','{a|b}'),[]);
 assert.deepEqual(omittedSourceGroups('{a|b}','a'),[]);
 assert.deepEqual(omittedSourceGroups('{{a|b}|tail}','a, b, tail'),[]);
});
test('restoration keeps a nested group inside an optional AND group',()=>{
 const original='{{blue eyes|green eyes}, long hair|}';
 const [group]=omittedSourceGroups(original,'{long hair|}');
 assert.equal(group.text,'{blue eyes|green eyes}');
 assert.equal(group.replacement,'{{blue eyes|green eyes}, long hair|}');
 assert.deepEqual(omittedSourceGroups(original,group.replacement),[]);
});
