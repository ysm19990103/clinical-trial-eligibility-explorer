import test from 'node:test';
import assert from 'node:assert/strict';
import {reportJSON,reportCSV,reportHTML} from '../app/exports.mjs';
import {evaluateAll} from '../app/engine.mjs';
import {STUDIES} from '../app/trials.mjs';
import {scenario,SCENARIOS} from '../app/examples.mjs';
import {validateCase,validateStudyPack} from '../app/parser.mjs';
const formats=[reportJSON,reportCSV,reportHTML];

test('all synthetic scenarios validate and return fresh independent case objects',()=>{
  for(const key of Object.keys(SCENARIOS)){const a=scenario(key),b=scenario(key);validateCase(a);a.facts={};assert.notDeepEqual(a,b);}
  assert.throws(()=>scenario('constructor'));assert.throws(()=>scenario('unknown'));
});
test('curated public study abstractions always retain manual protocol review',()=>{
  assert.equal(STUDIES.filter(s=>s.provenance==='public-curated').length,3);
  for(const s of STUDIES.filter(s=>s.provenance==='public-curated'))assert.ok(s.criteria.some(c=>c.rule.op==='manual'),s.id);
  const results=evaluateAll(STUDIES,scenario('baseline'));for(let i=0;i<STUDIES.length;i++)if(STUDIES[i].provenance==='public-curated')assert.notEqual(results[i].status,'meets');
});
test('built-in trial packs round-trip through strict import validation without losing study order',()=>{
  const imported=validateStudyPack({schema:'eligibility-study-pack.v1',studies:STUDIES});assert.deepEqual(imported.map(s=>s.id),STUDIES.map(s=>s.id));
});
test('missing-evidence scenario never converts absent facts into favorable clinical conclusions',()=>{
  const results=evaluateAll(STUDIES,scenario('missing'));assert.ok(results.every(r=>r.counts.unknown>0));
});
test('stale scenario surfaces evidence age and unit mismatch in the synthetic sandbox',()=>{
  const sandbox=STUDIES.filter(s=>s.provenance==='synthetic');assert.ok(sandbox.length>0);
  const text=JSON.stringify(evaluateAll(sandbox,scenario('stale')));
  assert.match(text,/older than|stale/i);assert.match(text,/unit/i);assert.match(text,/unknown/);
});
test('all reports omit raw case values, source text, imported labels, identifiers and URLs',()=>{
  const canary='SYNTHETIC-RAW-CANARY';
  const s={...STUDIES[0],id:canary,title:canary,shortTitle:canary,sourceUrl:'https://clinicaltrials.gov/#'+canary,eligibilityText:canary,criteria:STUDIES[0].criteria.map((c,i)=>({...c,id:canary+i,label:canary,note:canary}))};
  const c=scenario('baseline');c.facts.sex={value:canary};c.facts.anc={value:123.456789,unit:canary};
  const results=evaluateAll([s],c);
  for(const format of formats){const text=format([s],c,results);assert.equal(text.includes(canary),false);assert.equal(text.includes('123.456789'),false);assert.equal(text.includes('eligibilityText'),false);}
});
test('JSON reports preserve explicit uncertainty and state the selected-subset limitation',()=>{
  const c=scenario('missing');const text=reportJSON(STUDIES,c,evaluateAll(STUDIES,c));const parsed=JSON.parse(text);
  assert.ok(parsed&&typeof parsed==='object');assert.match(text,/unknown/);assert.match(text,/selected|subset|protocol/i);assert.equal(text.includes('"facts"'),false);
});
test('CSV exports contain statuses and aliases without clinical values or executable formula text',()=>{
  const c=scenario('baseline');const text=reportCSV(STUDIES,c,evaluateAll(STUDIES,c));
  assert.match(text,/unknown|does_not_meet|meets/);assert.match(text,/T0+1/);
});
test('HTML reports are standalone, script-free and protected by a restrictive CSP',()=>{
  const c=scenario('missing');const text=reportHTML(STUDIES,c,evaluateAll(STUDIES,c));
  assert.match(text,/<!doctype html>/i);assert.match(text,/Content-Security-Policy/i);assert.doesNotMatch(text,/<script\b/i);assert.doesNotMatch(text,/onerror=|onclick=/i);
});
test('report formatting does not mutate studies, cases or evaluation results',()=>{
  const c=scenario('baseline');const results=evaluateAll(STUDIES,c);const before=JSON.stringify({studies:STUDIES,c,results});
  for(const format of formats)format(STUDIES,c,results);assert.equal(JSON.stringify({studies:STUDIES,c,results}),before);
});
test('curated public mappings do not silently substitute ECOG for WHO performance status',()=>{
  const c=scenario('baseline');delete c.facts.whops;
  const flaura=STUDIES.find(s=>s.id==='NCT02296125');const result=evaluateAll([flaura],c)[0];
  const performance=result.criteria.find(r=>r.id==='performance');assert.equal(performance.status,'unknown');
  assert.equal(result.criteria.find(r=>r.id==='performance-stability').status,'unknown');
});
test('missing targeted-therapy determination is not inferred from negative or absent biomarker tests',()=>{
  const c=scenario('baseline');delete c.facts.egfrAlkTherapyIndicated;
  const keynote=STUDIES.find(s=>s.id==='NCT02578680');const result=evaluateAll([keynote],c)[0];
  assert.equal(result.criteria.find(r=>r.id==='targeted-therapy').status,'unknown');
});
test('ADAURA age qualifications and treatment timing retain manual uncertainty',()=>{
  const c=scenario('baseline');c.facts.age.value=19;c.facts.priorSystemic.value=true;
  const adaura=STUDIES.find(s=>s.id==='NCT02511106');const result=evaluateAll([adaura],c)[0];
  assert.equal(result.criteria.find(r=>r.id==='age').status,'unknown');
  assert.equal(result.criteria.find(r=>r.id==='timing').status,'unknown');
  assert.equal(result.criteria.some(r=>r.facts.includes('priorSystemic')),false);
});
test('public CNS exceptions are not flattened into the fictional sandbox exclusion',()=>{
  const c=scenario('baseline');c.facts.activeCns.value=true;
  const publicStudies=STUDIES.filter(s=>s.provenance==='public-curated');
  const results=evaluateAll(publicStudies,c);
  assert.equal(results.some(r=>r.criteria.some(x=>x.facts.includes('activeCns'))),false);
});

test('ADAURA qualifying EGFR result remains unknown without central confirmation',()=>{
 const c=scenario('baseline');c.facts.egfr={value:'l858r'};
 const study=STUDIES.find(s=>s.id==='NCT02511106');
 const row=evaluateAll([study],c)[0].criteria.find(x=>x.id==='egfr');
 assert.equal(row.status,'unknown');assert.equal(row.tree.children[1].reasonCode,'manual');
 c.facts.egfr={value:'not_detected'};
 assert.equal(evaluateAll([study],c)[0].criteria.find(x=>x.id==='egfr').status,'does_not_meet');
});
