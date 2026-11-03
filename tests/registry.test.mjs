import test from 'node:test';
import assert from 'node:assert/strict';
import {importRegistry} from '../app/registry.mjs';
import {evaluateStudy} from '../app/engine.mjs';
import {ImportError} from '../app/parser.mjs';
const record=()=>({protocolSection:{identificationModule:{nctId:'NCT01234567',briefTitle:'Synthetic registry fixture'},statusModule:{overallStatus:'COMPLETED',lastUpdatePostDateStruct:{date:'2026-10-10'}},conditionsModule:{conditions:['Synthetic condition']},designModule:{phases:['PHASE3']},eligibilityModule:{minimumAge:'18 Years',maximumAge:'70 Years',sex:'FEMALE',healthyVolunteers:false,eligibilityCriteria:'Inclusion Criteria:\n* Synthetic complex protocol condition\nExclusion Criteria:\n* Synthetic exception requiring review'},contactsLocationsModule:{centralContacts:[{name:'SYNTHETIC-CONTACT-CANARY',phone:'SYNTHETIC-PHONE-CANARY'}]}}});
const clinicalCase=(age=55,sex='female')=>({schema:'eligibility-case.v1',asOf:'2026-11-03',facts:{age:{value:age,unit:'years'},sex:{value:sex}}});
function leafRules(study){const out=[];function walk(n){if(n.op==='compare')out.push(n);for(const c of n.children||[])walk(c);if(n.child)walk(n.child);}study.criteria.forEach(c=>walk(c.rule));return out;}
test('registry importer accepts single API-v2 study and wrapped studies response',()=>{
  const single=importRegistry(record());const wrapped=importRegistry({studies:[record()]});
  assert.equal(single.length,1);assert.equal(wrapped.length,1);assert.equal(single[0].id,'NCT01234567');assert.equal(single[0].provenance,'registry-import');
});
test('registry import keeps only allowed study information and drops personal contact surfaces',()=>{
  const study=importRegistry(record())[0];const text=JSON.stringify(study);
  assert.equal(text.includes('SYNTHETIC-CONTACT-CANARY'),false);assert.equal(text.includes('SYNTHETIC-PHONE-CANARY'),false);
  assert.equal(study.sourceUrl,'https://clinicaltrials.gov/study/NCT01234567');
});
test('registry year ages use inclusive bounds and sex is a separate requirement',()=>{
  const s=importRegistry(record())[0];const leaves=leafRules(s);
  assert.ok(leaves.some(r=>r.field==='age'&&r.comparator==='gte'&&r.value===18));
  assert.ok(leaves.some(r=>r.field==='age'&&r.comparator==='lte'&&r.value===70));
  assert.equal(evaluateStudy(s,clinicalCase(17)).status,'does_not_meet');assert.equal(evaluateStudy(s,clinicalCase(71)).status,'does_not_meet');
  assert.equal(evaluateStudy(s,clinicalCase(18)).status,'unknown');assert.equal(evaluateStudy(s,clinicalCase(70)).status,'unknown');
  assert.equal(evaluateStudy(s,clinicalCase(55,'male')).status,'does_not_meet');
});
test('registry free-text criteria are retained as source text and never inferred into clinical rules',()=>{
  const r=record();r.protocolSection.eligibilityModule.eligibilityCriteria='ECOG less than 2 except when investigator permits. Active disease is excluded unless treated.';
  const s=importRegistry(r)[0];assert.ok(s.criteria.some(c=>c.rule.op==='manual'));
  assert.equal(leafRules(s).some(r=>r.field==='ecog'||r.field==='activeCns'),false);
  assert.equal(evaluateStudy(s,clinicalCase()).status,'unknown');
});
test('non-year age limits are not converted using guessed month or day ratios',()=>{
  for(const age of ['18 Months','52 Weeks','365 Days','18.5 Years','Unknown']){const r=record();r.protocolSection.eligibilityModule.minimumAge=age;const s=importRegistry(r)[0];assert.equal(leafRules(s).some(n=>n.field==='age'&&n.comparator==='gte'),false);assert.ok(s.criteria.some(c=>c.rule.op==='manual'));}
});
test('empty eligibility metadata stays manually unresolved',()=>{
  const r=record();r.protocolSection.eligibilityModule={};const s=importRegistry(r)[0];assert.equal(evaluateStudy(s,clinicalCase()).status,'unknown');
});
test('records without an eligibility module are explicitly rejected',()=>{
  const r=record();delete r.protocolSection.eligibilityModule;assert.throws(()=>importRegistry(r),ImportError);
});
test('registry import rejects invalid identities, empty collections, duplicates and excessive studies',()=>{
  for(const bad of [{},{studies:[]},{studies:Array.from({length:21},record)},{studies:[record(),record()]}])assert.throws(()=>importRegistry(bad),ImportError);
  for(const id of ['nct01234567','NCT123','https://example.org','<script>']){const r=record();r.protocolSection.identificationModule.nctId=id;assert.throws(()=>importRegistry(r),ImportError);}
});
test('registry eligibility text is bounded rather than silently truncated',()=>{
  const r=record();r.protocolSection.eligibilityModule.eligibilityCriteria='x'.repeat(20001);assert.throws(()=>importRegistry(r),ImportError);
});
test('registry import leaves the original record unchanged and never includes raw source objects',()=>{
  const r=record();const before=JSON.stringify(r);const s=importRegistry(r)[0];assert.equal(JSON.stringify(r),before);assert.equal(Object.hasOwn(s,'protocolSection'),false);
});
