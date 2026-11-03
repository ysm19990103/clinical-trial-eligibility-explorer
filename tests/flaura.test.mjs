import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {evaluateStudy,evaluateAll} from '../app/engine.mjs';
import {validateCase,validateStudyPack} from '../app/parser.mjs';
import {reportJSON,reportCSV,reportHTML} from '../app/exports.mjs';
import {FIELDS,RULESET} from '../app/catalog.mjs';
import {scenario} from '../app/examples.mjs';
import {STUDY_BY_ID} from '../app/trials.mjs';

const flaura=STUDY_BY_ID.NCT02296125;
// Fictional facts only; all pre-existing automated FLAURA checks are favorable.
function syntheticCase(value){
  const c=scenario('baseline');
  c.facts.egfr={value:'l858r'};
  if(value===undefined)delete c.facts.measurable;
  else c.facts.measurable={value};
  return c;
}
const row=(result,id)=>{
  const found=result.criteria.find(c=>c.id===id);
  assert.ok(found,`Expected the ${id} criterion`);
  return found;
};
const states=[
  ['confirmed',true,'meets','true','yes','unknown',0],
  ['documented absent',false,'does_not_meet','false','no','does_not_meet',1],
  ['explicitly unknown',null,'unknown','unknown','missing','unknown',0],
  ['not supplied',undefined,'unknown','unknown','missing','unknown',0]
];

for(const [name,value,status,predicate,reason,overall] of states){
  test(`FLAURA measurable disease: ${name} evidence has the correct three-state result`,()=>{
    const c=validateCase(syntheticCase(value));
    const result=evaluateStudy(flaura,c),measurable=row(result,'measurable');
    assert.equal(measurable.kind,'inclusion');
    assert.equal(measurable.status,status);
    assert.equal(measurable.predicate,predicate);
    assert.equal(measurable.tree.reasonCode,reason);
    assert.deepEqual(measurable.facts,['measurable']);
    assert.equal(result.status,overall);
    assert.equal(result.counts.does_not_meet,value===false?1:0);
    assert.equal(result.coverage,'selected-subset');
    assert.equal(row(result,'measurable-qualifications').status,'unknown');
    assert.equal(row(result,'remaining-protocol').status,'unknown');
  });
}

test('FLAURA does not coerce malformed measurable evidence into a pass or a barrier',()=>{
  for(const value of ['true','false',0,1,{},[]]){
    const c=syntheticCase(value);
    assert.throws(()=>validateCase(c));
    const result=row(evaluateStudy(flaura,c),'measurable');
    assert.equal(result.status,'unknown');
    assert.equal(result.tree.reasonCode,'invalid');
  }
});

test('FLAURA future-dated measurable evidence cannot establish the selected prerequisite',()=>{
  const c=syntheticCase(true);
  c.facts.measurable.observedOn='2026-11-04';
  const result=row(evaluateStudy(flaura,validateCase(c)),'measurable');
  assert.equal(result.status,'unknown');
  assert.equal(result.tree.reasonCode,'future');
});

test('FLAURA imaging and biopsy intervals are not inferred from unrelated dates or therapy intervals',()=>{
  for(const observedOn of ['2026-10-19','2026-10-20','2026-10-21']){
    const c=syntheticCase(true);
    c.facts.measurable.observedOn=observedOn;
    c.facts.daysSinceTherapy={value:14,unit:'days'};
    const result=evaluateStudy(flaura,validateCase(c));
    assert.equal(row(result,'measurable').status,'meets');
    const qualification=row(result,'measurable-qualifications');
    assert.equal(qualification.status,'unknown');
    assert.equal(qualification.tree.reasonCode,'manual');
    assert.deepEqual(qualification.facts,[]);
  }
});

test('favorable FLAURA selected facts still require imaging, stability, CNS and remaining-protocol review',()=>{
  const result=evaluateStudy(flaura,validateCase(syntheticCase(true)));
  assert.equal(result.counts.does_not_meet,0);
  for(const id of ['measurable-qualifications','performance-stability','cns-exceptions','remaining-protocol']){
    assert.equal(row(result,id).status,'unknown',id);
    assert.equal(row(result,id).tree.reasonCode,'manual',id);
  }
  assert.equal(result.status,'unknown');
  assert.equal(result.coverage,'selected-subset');
});

test('FLAURA rule-pack import retains protocol sources, qualifiers and the remaining-protocol guard',()=>{
  const [imported]=validateStudyPack({schema:'eligibility-study-pack.v1',studies:[flaura]});
  for(const id of ['measurable','measurable-qualifications']){
    const source=flaura.criteria.find(c=>c.id===id),copy=imported.criteria.find(c=>c.id===id);
    assert.ok(source&&copy);
    assert.equal(copy.sourceUrl,'https://cdn.clinicaltrials.gov/large-docs/25/NCT02296125/Prot_000.pdf#page=39');
    assert.equal(copy.note,source.note);
  }
  for(const [,value,status] of states){
    const result=evaluateStudy(imported,validateCase(syntheticCase(value)));
    assert.equal(row(result,'measurable').status,status);
    assert.equal(row(result,'remaining-protocol').status,'unknown');
  }
});

test('FLAURA reports expose the selected result and uncertainty without raw case facts',()=>{
  for(const [,value,status] of states){
    const c=validateCase(syntheticCase(value)),studies=[flaura],results=evaluateAll(studies,c);
    const json=JSON.parse(reportJSON(studies,c,results));
    assert.equal(json.ruleset,RULESET);
    assert.notEqual(json.ruleset,'eligibility-selected-2026-11-03');
    const measurable=json.studies[0].criteria.find(r=>r.fields.includes(FIELDS.measurable.label));
    assert.equal(measurable.decision,status);
    assert.notEqual(json.studies[0].decision,'meets');
    assert.match(json.studies[0].scope,/Selected subset/);
    const index=flaura.criteria.findIndex(r=>r.id==='remaining-protocol');
    assert.equal(json.studies[0].criteria[index].decision,'unknown');
    for(const format of [reportJSON,reportCSV,reportHTML]){
      const report=format(studies,c,results);
      assert.match(report,/Selected criteria only/);
      assert.match(report,/unknown|Unknown/);
      assert.doesNotMatch(report,/"facts"|"value"|l858r|NCT02296125/);
    }
    const csv=reportCSV(studies,c,results).split('\r\n').find(line=>line.includes(FIELDS.measurable.label));
    assert.ok(csv.includes(`"${status}"`));
  }
});

test('CLI FLAURA synthetic review distinguishes absent disease from missing evidence after validated import',()=>{
  const dir=mkdtempSync(join(tmpdir(),'flaura-synthetic-'));
  try{
    const pack=join(dir,'synthetic-study-pack.json');
    writeFileSync(pack,JSON.stringify({schema:'eligibility-study-pack.v1',studies:[flaura]}));
    for(const [,value,status,,,,exitCode] of states){
      const result=spawnSync(process.execPath,[resolve('scripts/audit.mjs'),'--studies',pack],{
        input:JSON.stringify(syntheticCase(value)),encoding:'utf8',timeout:10000,maxBuffer:1024*1024
      });
      assert.equal(result.status,exitCode,result.stderr);
      assert.equal(result.stderr,'');
      const report=JSON.parse(result.stdout),review=report.studies[0];
      assert.equal(review.criteria.find(c=>c.fields.includes(FIELDS.measurable.label)).decision,status);
      assert.notEqual(review.decision,'meets');
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('KEYNOTE-189 retains its independent three-state measurable check and remainder guard',()=>{
  for(const [,value,status] of states){
    const result=evaluateStudy(STUDY_BY_ID.NCT02578680,validateCase(syntheticCase(value)));
    assert.equal(row(result,'measurable').status,status);
    assert.equal(row(result,'remaining-protocol').status,'unknown');
  }
});

test('ADAURA adjuvant mapping does not acquire FLAURA measurable-disease requirements',()=>{
  const adaura=STUDY_BY_ID.NCT02511106;
  const present=evaluateStudy(adaura,validateCase(syntheticCase(true)));
  const absent=evaluateStudy(adaura,validateCase(syntheticCase(false)));
  assert.deepEqual(present,absent);
  assert.equal(present.criteria.some(c=>c.facts.includes('measurable')),false);
  assert.equal(row(present,'remaining-protocol').status,'unknown');
});
