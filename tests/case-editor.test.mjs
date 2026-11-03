import test from 'node:test';
import assert from 'node:assert/strict';
import {caseFromForm} from '../app/case-editor.mjs';
import {ImportError} from '../app/parser.mjs';
import {evaluateAll} from '../app/engine.mjs';
import {STUDIES} from '../app/trials.mjs';

const form=(entries={})=>{
  const value=new FormData();value.set('asOf','2026-11-03');
  for(const [key,text] of Object.entries(entries))value.set(key,text);
  return value;
};
const criterion=(input,study,id)=>evaluateAll(STUDIES,input).find(s=>s.id===study).criteria.find(c=>c.id===id);

test('editor retains unknown age when a unit is absent until it is explicitly supplied',()=>{
  const input=form({age:'30',age__unit:'',sex:'female'});
  const missing=caseFromForm(input);
  assert.equal(Object.hasOwn(missing.facts.age,'unit'),false);
  assert.equal(criterion(missing,'NCT02578680','adult').tree.reasonCode,'unit');
  input.set('sex','male');
  assert.equal(criterion(caseFromForm(input),'NCT02578680','adult').status,'unknown');
  input.set('age__unit','years');
  assert.equal(criterion(caseFromForm(input),'NCT02578680','adult').status,'meets');
});
test('editor preserves an explicitly mismatched unit without conversion',()=>{
  const input=caseFromForm(form({age:'30',age__unit:'months'}));
  assert.equal(input.facts.age.unit,'months');
  assert.equal(criterion(input,'NCT02578680','adult').status,'unknown');
});
test('editor rejects overprecision, overflow and nonzero underflow before evaluating',()=>{
  for(const anc of ['1.49999999999999999','1.50000000000000001','1e-999','1e999']){
    assert.throws(()=>caseFromForm(form({anc,anc__unit:'10^9/L',anc__date:'2026-11-03'})),error=>error instanceof ImportError&&error.code==='precision');
  }
});
test('editor preserves valid values on each side of the ANC boundary',()=>{
  for(const [anc,status] of [['1.49999999999999','does_not_meet'],['1.5','meets'],['1.50000000000001','meets']]){
    const input=caseFromForm(form({anc,anc__unit:'10^9/L',anc__date:'2026-11-03'}));
    assert.equal(criterion(input,'SYNTHETIC-LAB','anc').status,status);
  }
});
test('editor distinguishes empty evidence from a supplied false boolean',()=>{
  const input=caseFromForm(form({age:'',age__unit:'',activeCns:'false',activeAutoimmune:''}));
  assert.equal(input.facts.age.value,null);assert.equal(input.facts.activeAutoimmune.value,null);
  assert.equal(input.facts.activeCns.value,false);assert.equal(Object.hasOwn(input.facts.age,'observedOn'),false);
});
test('editor validates dates, ranges, category values and boolean text before commit',()=>{
  for(const entries of [{asOf:'2026-02-30'},{age:'131'},{ecog:'.5'},{sex:'unexpected'},{activeCns:'no'},{age:'30',age__date:'2026-02-30'}])assert.throws(()=>caseFromForm(form(entries)),ImportError);
});
