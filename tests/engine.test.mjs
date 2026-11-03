import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateStudy,evaluateAll} from '../app/engine.mjs';
import {FIELDS} from '../app/catalog.mjs';

const asOf='2026-11-03';
const fact=(value,extra={})=>({value,...extra});
const clinicalCase=(facts={},date=asOf)=>({schema:'eligibility-case.v1',asOf:date,facts});
const compare=(field,value,comparator='eq',extra={})=>({op:'compare',field,value,comparator,...extra});
const bool=value=>compare('activeCns',value);
const study=(rules,kinds=[])=>({id:'DEMO-TEST',title:'Synthetic test protocol',shortTitle:'Test',condition:'Synthetic condition',phase:'Not applicable',status:'SYNTHETIC',sourceDate:asOf,reviewedOn:asOf,sourceUrl:'https://clinicaltrials.gov/',provenance:'synthetic',coverageNote:'Selected tests only',criteria:rules.map((rule,i)=>({id:`C${i+1}`,kind:kinds[i]||'inclusion',label:`Synthetic criterion ${i+1}`,rule}))});
const criterion=(rule,facts={},kind='inclusion',date=asOf)=>evaluateStudy(study([rule],[kind]),clinicalCase(facts,date)).criteria[0];
const truthRules={true:compare('age',18,'gte',{unit:FIELDS.age.unit}),false:compare('age',99,'gte',{unit:FIELDS.age.unit}),unknown:bool(true)};
const knownAge={age:fact(45,{unit:FIELDS.age.unit})};

test('AND evaluates all nine three-valued combinations without short-circuiting explanations',()=>{
  const expected={true:{true:'true',false:'false',unknown:'unknown'},false:{true:'false',false:'false',unknown:'false'},unknown:{true:'unknown',false:'false',unknown:'unknown'}};
  for(const a of Object.keys(truthRules))for(const b of Object.keys(truthRules)){
    const result=criterion({op:'all',children:[truthRules[a],truthRules[b]]},knownAge);
    assert.equal(result.predicate,expected[a][b],`${a} AND ${b}`);
    assert.equal(result.tree.children.length,2);
    assert.equal(result.tree.children[0].truth,a);
    assert.equal(result.tree.children[1].truth,b);
  }
});
test('OR evaluates all nine three-valued combinations and retains unknown child evidence',()=>{
  const expected={true:{true:'true',false:'true',unknown:'true'},false:{true:'true',false:'false',unknown:'unknown'},unknown:{true:'true',false:'unknown',unknown:'unknown'}};
  for(const a of Object.keys(truthRules))for(const b of Object.keys(truthRules)){
    const result=criterion({op:'any',children:[truthRules[a],truthRules[b]]},knownAge);
    assert.equal(result.predicate,expected[a][b],`${a} OR ${b}`);
    assert.equal(result.tree.children.length,2);
  }
});
test('NOT flips known truth while preserving unknown',()=>{
  for(const [value,expected] of [['true','false'],['false','true'],['unknown','unknown']])assert.equal(criterion({op:'not',child:truthRules[value]},knownAge).predicate,expected);
});
test('exclusion polarity inverts a predicate once and never turns missing evidence into a pass',()=>{
  for(const [value,predicate,status] of [[true,'true','does_not_meet'],[false,'false','meets'],[null,'unknown','unknown']]){
    const result=criterion(bool(true),{activeCns:fact(value)},'exclusion');
    assert.equal(result.predicate,predicate);assert.equal(result.status,status);
  }
  assert.equal(criterion({op:'not',child:bool(true)},{activeCns:fact(true)},'exclusion').status,'meets');
});
test('all criteria are returned and overall decision prioritizes barriers then unknown evidence',()=>{
  const c=clinicalCase(knownAge);
  const failure=evaluateStudy(study([truthRules.false,truthRules.unknown,truthRules.true]),c);
  assert.equal(failure.status,'does_not_meet');assert.equal(failure.criteria.length,3);
  assert.deepEqual(failure.counts,{meets:1,does_not_meet:1,unknown:1});
  assert.equal(evaluateStudy(study([truthRules.true,truthRules.unknown]),c).status,'unknown');
  assert.equal(evaluateStudy(study([truthRules.true]),c).status,'meets');
  assert.equal(failure.coverage,'selected-subset');
});
test('numeric comparisons honor strict and inclusive boundaries including zero',()=>{
  for(const [comparator,expected] of [['gte','meets'],['lte','meets'],['eq','meets'],['gt','does_not_meet'],['lt','does_not_meet']])assert.equal(criterion(compare('age',18,comparator,{unit:FIELDS.age.unit}),{age:fact(18,{unit:FIELDS.age.unit})}).status,expected);
  assert.equal(criterion(compare('ecog',0,'eq',{unit:FIELDS.ecog.unit}),{ecog:fact(0,{unit:FIELDS.ecog.unit})}).status,'meets');
});
test('missing and explicit null facts are unknown, but false is a valid boolean',()=>{
  for(const facts of [{},{activeCns:fact(null)}])assert.equal(criterion(bool(false),facts).status,'unknown');
  assert.equal(criterion(bool(false),{activeCns:fact(false)}).status,'meets');
});
test('numeric and boolean strings are not coerced into clinical values',()=>{
  for(const value of ['18',true,{},[],NaN,Infinity])assert.equal(criterion(compare('age',18,'gte',{unit:FIELDS.age.unit}),{age:fact(value,{unit:FIELDS.age.unit})}).status,'unknown');
  for(const value of ['false',0,1,{},[]])assert.equal(criterion(bool(false),{activeCns:fact(value)}).status,'unknown');
});
test('out-of-range and fractional integer-scale values are unknown',()=>{
  for(const value of [-1,999])assert.equal(criterion(compare('age',18,'gte',{unit:FIELDS.age.unit}),{age:fact(value,{unit:FIELDS.age.unit})}).status,'unknown');
  assert.equal(criterion(compare('ecog',1,'lte',{unit:FIELDS.ecog.unit}),{ecog:fact(0.5,{unit:FIELDS.ecog.unit})}).status,'unknown');
});
test('enum equality and membership are explicit; unknown tokens are never assumed negative',()=>{
  const [a,b]=FIELDS.sex.options.map(x=>x.value);
  assert.equal(criterion(compare('sex',a),{sex:fact(a)}).status,'meets');
  assert.equal(criterion(compare('sex',[a,b],'in'),{sex:fact(b)}).status,'meets');
  assert.equal(criterion(compare('sex',a),{sex:fact('SYNTHETIC-UNKNOWN-TOKEN')}).status,'unknown');
});
test('exact units are required, without implicit conversion or inference',()=>{
  const rule=compare('anc',1.5,'gte',{unit:FIELDS.anc.unit});
  assert.equal(criterion(rule,{anc:fact(1.5,{unit:FIELDS.anc.unit})}).status,'meets');
  assert.equal(criterion(rule,{anc:fact(1500,{unit:'cells/uL'})}).status,'unknown');
  assert.equal(criterion(rule,{anc:fact(1.5)}).status,'unknown');
});
test('measurement freshness includes its exact final day and becomes unknown one day later',()=>{
  const rule=compare('anc',1.5,'gte',{unit:FIELDS.anc.unit,maxAgeDays:14});
  assert.equal(criterion(rule,{anc:fact(2,{unit:FIELDS.anc.unit,observedOn:'2026-10-20'})}).status,'meets');
  assert.equal(criterion(rule,{anc:fact(2,{unit:FIELDS.anc.unit,observedOn:'2026-10-19'})}).status,'unknown');
  assert.equal(criterion(rule,{anc:fact(2,{unit:FIELDS.anc.unit})}).status,'unknown');
});
test('zero-day freshness accepts same-day evidence and rejects prior-day evidence',()=>{
  const rule=compare('anc',1,'gte',{unit:FIELDS.anc.unit,maxAgeDays:0});
  assert.equal(criterion(rule,{anc:fact(2,{unit:FIELDS.anc.unit,observedOn:asOf})}).status,'meets');
  assert.equal(criterion(rule,{anc:fact(2,{unit:FIELDS.anc.unit,observedOn:'2026-11-02'})}).status,'unknown');
});
test('invalid or future dates cannot establish a passing criterion',()=>{
  const rule=compare('anc',1,'gte',{unit:FIELDS.anc.unit,maxAgeDays:14});
  for(const date of ['2026-02-30','2026-11-04','2026','2026-11-03T00:00:00Z',''])assert.equal(criterion(rule,{anc:fact(2,{unit:FIELDS.anc.unit,observedOn:date})}).status,'unknown',date);
  assert.equal(criterion(rule,{anc:fact(2,{unit:FIELDS.anc.unit,observedOn:asOf})},'inclusion','2026-02-30').status,'unknown');
});
test('freshness handles leap days and year boundaries using calendar days',()=>{
  const rule=compare('anc',1,'gte',{unit:FIELDS.anc.unit,maxAgeDays:1});
  assert.equal(criterion(rule,{anc:fact(2,{unit:FIELDS.anc.unit,observedOn:'2024-02-29'})},'inclusion','2024-03-01').status,'meets');
  assert.equal(criterion(rule,{anc:fact(2,{unit:FIELDS.anc.unit,observedOn:'2025-12-31'})},'inclusion','2026-01-01').status,'meets');
});
test('manual criteria remain unknown regardless of all other facts',()=>{
  const result=criterion({op:'manual',reason:'SYNTHETIC-MANUAL-CANARY'},knownAge);
  assert.equal(result.status,'unknown');assert.equal(result.predicate,'unknown');
  assert.equal(JSON.stringify(result.tree).includes('SYNTHETIC-MANUAL-CANARY'),false);
});
test('evaluation does not mutate the case, study, rule order or source values',()=>{
  const s=study([{op:'all',children:[truthRules.true,truthRules.unknown]}]);const c=clinicalCase(knownAge);const before=JSON.stringify({s,c});
  evaluateStudy(s,c);assert.equal(JSON.stringify({s,c}),before);
});
test('explanations never echo raw case values or unexpected field names',()=>{
  const canary='SYNTHETIC-CASE-CANARY';
  const result=evaluateStudy(study([bool(true),compare('sex',FIELDS.sex.options[0].value),{op:'compare',field:canary,comparator:'eq',value:canary}]),clinicalCase({activeCns:fact(canary),sex:fact(canary),[canary]:fact(canary)}));
  const traces=result.criteria.map(r=>({reason:r.reason,facts:r.facts,tree:r.tree}));
  assert.equal(JSON.stringify(traces).includes(canary),false);
});
test('direct malformed and empty rules remain unknown instead of optimistic passes or crashes',()=>{
  for(const rule of [null,{},[],{op:'all',children:[]},{op:'any',children:[]},{op:'not'},{op:'compare',field:'constructor',comparator:'eq',value:1},{op:'eval',source:'SYNTHETIC-EXECUTION-CANARY'}])assert.equal(criterion(rule,knownAge).status,'unknown');
});
test('evaluateAll preserves study order and does not manufacture rankings',()=>{
  const a=study([truthRules.true]),b={...study([truthRules.false]),id:'DEMO-SECOND'};
  const results=evaluateAll([b,a],clinicalCase(knownAge));
  assert.deepEqual(results.map(x=>x.id),[b.id,a.id]);
  assert.equal(JSON.stringify(results).includes('probability'),false);
});
test('nested groups evaluate the written logic rather than flattening inclusion and exclusion branches',()=>{
  const rule={op:'all',children:[truthRules.true,{op:'any',children:[truthRules.false,{op:'not',child:truthRules.false}]}]};
  assert.equal(criterion(rule,knownAge).status,'meets');
  assert.equal(criterion(rule,knownAge,'exclusion').status,'does_not_meet');
});
test('direct cyclic, excessively deep and over-budget rule trees yield bounded unknown results',()=>{
  const cycle={op:'not'};cycle.child=cycle;assert.equal(criterion(cycle,knownAge).status,'unknown');
  let deep=truthRules.true;for(let i=0;i<20;i++)deep={op:'not',child:deep};assert.equal(criterion(deep,knownAge).status,'unknown');
  const many={op:'all',children:Array.from({length:4},()=>({op:'all',children:Array.from({length:50},()=>truthRules.true)}))};assert.equal(criterion(many,knownAge).status,'unknown');
});
test('invalid case dates invalidate comparisons even without an explicit evidence window',()=>{
  assert.equal(criterion(truthRules.true,knownAge,'inclusion','not-a-date').status,'unknown');
});
test('malformed study or criterion lists return visible uncertainty',()=>{
  for(const s of [null,{},[],{criteria:[]},{criteria:[null]},{criteria:[{kind:'optional',rule:truthRules.true}]}]){
    const result=evaluateStudy(s,clinicalCase(knownAge));assert.equal(result.status,'unknown');assert.ok(result.criteria.length>0);
  }
});
test('malformed case fact combinations are bounded and never cause an uncaught evaluation error',()=>{
  const bad=[null,false,0,'SYNTHETIC-CANARY',[],{}, {value:[]},{value:{}},{value:null},{value:0,extra:true}];
  for(const field of Object.keys(FIELDS))for(const value of bad){
    const def=FIELDS[field],target=def.kind==='boolean'?true:def.kind==='enum'?def.options[0].value:1;
    const result=criterion(compare(field,target,'eq',{...(def.unit?{unit:def.unit}:{})}),{[field]:value});
    assert.ok(['meets','does_not_meet','unknown'].includes(result.status));
  }
});
