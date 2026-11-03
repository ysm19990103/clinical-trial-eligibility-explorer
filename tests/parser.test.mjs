import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInput,parseNumberLiteral,validateCase,validateStudyPack,ImportError} from '../app/parser.mjs';
import {FIELDS,LIMITS} from '../app/catalog.mjs';
const asOf='2026-11-03';
const sampleCase=()=>({schema:'eligibility-case.v1',asOf,facts:{age:{value:55,unit:FIELDS.age.unit},activeCns:{value:false}}});
const sampleStudy=()=>({id:'SYNTHETIC-TEST',title:'Synthetic test protocol',shortTitle:'Synthetic test',condition:'Synthetic',phase:'Not applicable',status:'SYNTHETIC',sourceDate:asOf,reviewedOn:asOf,sourceUrl:'https://clinicaltrials.gov/',provenance:'synthetic',coverageNote:'Selected checks only',criteria:[{id:'AGE',kind:'inclusion',label:'Age threshold',rule:{op:'compare',field:'age',comparator:'gte',value:18,unit:FIELDS.age.unit}},{id:'MANUAL',kind:'inclusion',label:'Unmapped protocol requirements',rule:{op:'manual'}}]});
const pack=s=>({schema:'eligibility-study-pack.v1',studies:s||[sampleStudy()]});
const rejects=fn=>assert.throws(fn,ImportError);

test('bounded JSON accepts valid objects, escaped strings, BOM and whitespace',()=>{
  const data=parseInput('\uFEFF \n{"schema":"eligibility-case.v1","facts":{"activeCns":{"value":false}},"asOf":"2026-11-03"}\r\n');
  assert.equal(data.facts.activeCns.value,false);assert.equal(Object.getPrototypeOf(data),null);
  assert.equal(parseInput('{"value":"a\\\\b\\\"c\\n\\u0041"}').value,'a\\b"c\nA');
});
test('duplicate decoded keys and prototype-sensitive keys are rejected at every nesting level',()=>{
  for(const text of ['{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"facts":{"__proto__":{}}}','{"constructor":1}','{"prototype":1}'])rejects(()=>parseInput(text));
});
test('invalid JSON, non-object roots and trailing content are rejected',()=>{
  for(const text of ['','null','false','3','[]','{"a":1,}','{"a":01}','{"a":NaN}','{"a":undefined}','{"a":true}{}','{"a":"unterminated}','{"a":[1,]}'])rejects(()=>parseInput(text));
});
test('unsafe numeric precision, overflow and nonzero underflow are rejected before evaluation',()=>{
  for(const number of ['1234567890123456','1.234567890123456','1e999','1e-999'])rejects(()=>parseInput(`{"a":${number}}`));
  assert.equal(parseInput('{"a":123456789012345,"b":0.5,"c":-0}').a,123456789012345);
});
test('decimal reader supports editor notation without weakening JSON number syntax',()=>{
  for(const [text,value] of [['.5',.5],['1.',1],['01',1],['+1',1],['1.5e1',15],['-0',-0]])assert.equal(parseNumberLiteral(text),value);
  for(const text of ['.5','1.','01','+1'])rejects(()=>parseInput(`{"a":${text}}`));
});
test('decimal reader rejects nondecimal text and retains fixed error messages',()=>{
  for(const text of ['', ' ', '0x10','1 2','Infinity','NaN','SYNTHETIC-NUMBER-CANARY','1e-999','1.49999999999999999']){
    assert.throws(()=>parseNumberLiteral(text),error=>error instanceof ImportError&&error.code==='precision'&&!error.message.includes('SYNTHETIC-NUMBER-CANARY'));
  }
});
test('JSON byte, string, node and nesting limits are enforced',()=>{
  rejects(()=>parseInput(' '.repeat(LIMITS.bytes+1)+'{}'));
  rejects(()=>parseInput(JSON.stringify({s:'a'.repeat(LIMITS.string+1)})));
  rejects(()=>parseInput('{"a":'+ '['.repeat(45)+'0'+']'.repeat(45)+'}'));
  rejects(()=>parseInput(JSON.stringify({values:Array.from({length:LIMITS.nodes+1},()=>0)})));
});
test('import errors contain fixed messages without input excerpts',()=>{
  const canary='SYNTHETIC-IMPORT-CANARY';
  try{parseInput(`{"${canary}":`);assert.fail('expected rejection');}catch(error){assert.ok(error instanceof ImportError);assert.equal(error.message.includes(canary),false);}
});
test('case validator accepts known typed facts and preserves explicit unknowns',()=>{
  const input=sampleCase();input.facts.ecog={value:null};
  const output=validateCase(input);assert.equal(output.asOf,asOf);assert.equal(output.facts.activeCns.value,false);assert.equal(output.facts.ecog.value,null);
});
test('case validator rejects private narrative and unknown schema/field keys',()=>{
  const bad=[{...sampleCase(),name:'SYNTHETIC-PERSON'}, {...sampleCase(),schema:'other'}, {...sampleCase(),facts:{privateNote:{value:'SYNTHETIC-NOTE'}}}, {...sampleCase(),facts:{age:{value:55,unit:FIELDS.age.unit,note:'SYNTHETIC-NOTE'}}}];
  for(const value of bad)rejects(()=>validateCase(value));
});
test('case validation rejects incompatible values, impossible scale values and invalid dates',()=>{
  const bad=[{age:{value:'55',unit:FIELDS.age.unit}},{age:{value:-2,unit:FIELDS.age.unit}},{ecog:{value:0.5,unit:FIELDS.ecog.unit}},{activeCns:{value:'false'}},{sex:{value:'UNRECOGNIZED'}},{anc:{value:2,unit:FIELDS.anc.unit,observedOn:'2026-02-30'}}];
  for(const facts of bad)rejects(()=>validateCase({...sampleCase(),facts}));
  for(const date of ['2026','2026-02-30','2026-13-01','2026-11-03T00:00:00Z'])rejects(()=>validateCase({...sampleCase(),asOf:date}));
});
test('study pack validator accepts explicit rules and returns a fresh bounded collection',()=>{
  const input=pack();const before=JSON.stringify(input);const result=validateStudyPack(input);
  assert.equal(result.length,1);assert.equal(result[0].criteria[0].rule.field,'age');assert.equal(JSON.stringify(input),before);
});
test('study pack rejects duplicate study/criterion ids and malformed identities',()=>{
  const same=sampleStudy();rejects(()=>validateStudyPack(pack([same,same])));
  for(const id of ['','SYNTHETIC ID','<unsafe>','x'.repeat(200)])rejects(()=>validateStudyPack(pack([{...same,id}])));
  same.criteria.push({...same.criteria[0]});rejects(()=>validateStudyPack(pack([same])));
});
test('study pack rejects executable or unknown rule operators, fields, comparators and empty groups',()=>{
  const rules=[{op:'eval',source:'return true'},{op:'all',children:[]},{op:'any',children:[]},{op:'not'},{op:'compare',field:'unknown',comparator:'eq',value:1},{op:'compare',field:'age',comparator:'approximately',value:18},{op:'compare',field:'age',comparator:'gte',value:'18'},{op:'compare',field:'activeCns',comparator:'gte',value:true},{op:'compare',field:'sex',comparator:'in',value:[]},{op:'compare',field:'sex',comparator:'in',value:Array(21).fill(FIELDS.sex.options[0].value)}];
  for(const rule of rules){const s=sampleStudy();s.criteria[0].rule=rule;rejects(()=>validateStudyPack(pack([s])));}
});
test('study pack rejects unsafe source URLs, excess text and invalid criterion polarity',()=>{
  for(const sourceUrl of ['javascript:alert(1)','https://example.org/private','https://clinicaltrials.gov.evil.invalid/study/NCT12345678','http://clinicaltrials.gov/study/NCT12345678']){const s=sampleStudy();s.sourceUrl=sourceUrl;rejects(()=>validateStudyPack(pack([s])));}
  const s=sampleStudy();s.title='x'.repeat(501);rejects(()=>validateStudyPack(pack([s])));
  const t=sampleStudy();t.criteria[0].kind='optional';rejects(()=>validateStudyPack(pack([t])));
});
test('study pack enforces collection, criterion, rule-node and depth limits',()=>{
  rejects(()=>validateStudyPack(pack(Array.from({length:21},(_,i)=>({...sampleStudy(),id:`S${i}`})))));
  const s=sampleStudy();s.criteria=Array.from({length:61},(_,i)=>({...s.criteria[0],id:`C${i}`}));rejects(()=>validateStudyPack(pack([s])));
  const t=sampleStudy();let deep={op:'manual'};for(let i=0;i<10;i++)deep={op:'not',child:deep};t.criteria[0].rule=deep;rejects(()=>validateStudyPack(pack([t])));
  const u=sampleStudy();u.criteria[0].rule={op:'all',children:Array.from({length:4},()=>({op:'all',children:Array.from({length:50},()=>({op:'manual'}))}))};rejects(()=>validateStudyPack(pack([u])));
});
test('freshness rule limits must be finite nonnegative integral days',()=>{
  for(const maxAgeDays of [-1,1.5,3651,'14']){const s=sampleStudy();s.criteria[0].rule.maxAgeDays=maxAgeDays;rejects(()=>validateStudyPack(pack([s])));}
});
test('imported study packs cannot claim trusted provenance or complete protocol coverage',()=>{
  const s=sampleStudy();s.provenance='public-curated';s.criteria=s.criteria.slice(0,1);
  const result=validateStudyPack(pack([s]))[0];
  assert.equal(result.provenance,'local-pack');assert.ok(result.criteria.some(c=>c.rule.op==='manual'));
});
test('an OR branch containing manual review cannot remove the mandatory remaining-protocol guard',()=>{
  const s=sampleStudy();s.criteria=[{...s.criteria[0],rule:{op:'any',children:[s.criteria[0].rule,{op:'manual'}]}}];
  const result=validateStudyPack(pack([s]))[0];assert.ok(result.criteria.some(c=>c.rule.op==='manual'));
});
test('study pack guard insertion respects its criterion limit',()=>{
  const s=sampleStudy();s.criteria=Array.from({length:60},(_,i)=>({...s.criteria[0],id:`C${i}`}));
  rejects(()=>validateStudyPack(pack([s])));
});
test('empty studies and empty criterion collections are rejected rather than treated as clean reviews',()=>{
  rejects(()=>validateStudyPack(pack([])));const s=sampleStudy();s.criteria=[];rejects(()=>validateStudyPack(pack([s])));
});
test('case validation retains mismatched units for explicit unknown analysis rather than converting them',()=>{
  const c=sampleCase();c.facts.anc={value:1.5,unit:'cells/uL'};
  assert.equal(validateCase(c).facts.anc.unit,'cells/uL');assert.equal(c.facts.anc.value,1.5);
});
test('unsafe source URL credentials, query strings and nondefault ports are rejected',()=>{
  for(const sourceUrl of ['https://user:password'+'@'+'clinicaltrials.gov/study/NCT12345678','https://clinicaltrials.gov:8443/study/NCT12345678','https://clinicaltrials.gov/study/NCT12345678?private=SYNTHETIC-CANARY']){const s=sampleStudy();s.sourceUrl=sourceUrl;rejects(()=>validateStudyPack(pack([s])));}
});
