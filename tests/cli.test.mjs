import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {scenario} from '../app/examples.mjs';
const script=resolve('scripts/audit.mjs');
const run=(args=[],input=JSON.stringify(scenario('missing')))=>spawnSync(process.execPath,[script,...args],{input,encoding:'utf8',maxBuffer:8*1024*1024,timeout:10000});
test('CLI reads case JSON from stdin and emits a limited review with zero for unknown-only results',()=>{
  const r=run();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/unknown/);assert.doesNotThrow(()=>JSON.parse(r.stdout));assert.equal(r.stderr,'');
});
test('CLI exits one when a selected criterion barrier is present while retaining the report',()=>{
  const r=run([],JSON.stringify(scenario('barriers')));assert.equal(r.status,1,r.stderr);assert.match(r.stdout,/does_not_meet/);
});
test('CLI supports JSON, CSV and HTML reports',()=>{
  for(const format of ['json','csv','html']){const r=run(['--format',format]);assert.equal(r.status,0,r.stderr);assert.ok(r.stdout.length>100);if(format==='html')assert.match(r.stdout,/<!doctype html>/i);}
});
test('CLI file input and optional study pack work without leaking path or source metadata',()=>{
  const dir=mkdtempSync(join(tmpdir(),'eligibility-test-'));try{
    const path=join(dir,'SYNTHETIC-FILENAME-CANARY.json');writeFileSync(path,JSON.stringify(scenario('missing')));
    const studies=join(dir,'SYNTHETIC-PACK-CANARY.json');writeFileSync(studies,JSON.stringify({schema:'eligibility-study-pack.v1',studies:[{id:'LOCAL-TEST',title:'SYNTHETIC-TITLE-CANARY',criteria:[{id:'CHECK',kind:'inclusion',label:'SYNTHETIC-LABEL-CANARY',rule:{op:'manual'}}]}]}));
    const r=run([path,'--studies',studies],'');assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/unknown/);assert.doesNotMatch(r.stdout+r.stderr,/CANARY/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('CLI rejects malformed, oversized and invalid UTF-8 input without partial reports',()=>{
  for(const input of ['{"private":"SYNTHETIC-CANARY",',' '.repeat(2097153),Buffer.from([0xff,0xfe,0xfd])]){const r=run([],input);assert.equal(r.status,2);assert.equal(r.stdout,'');assert.doesNotMatch(r.stderr,/SYNTHETIC-CANARY/);}
});
test('CLI rejects unknown or incomplete options without echoing arbitrary arguments',()=>{
  for(const args of [['--unknown-SYNTHETIC-CANARY'],['--format'],['--format','xml'],['--studies'],['--case','x'],['one','two']]){const r=run(args);assert.equal(r.status,2);assert.equal(r.stdout,'');assert.doesNotMatch(r.stderr,/SYNTHETIC-CANARY/);}
});
test('CLI unreadable input errors do not echo the provided path',()=>{
  const r=run(['/SYNTHETIC-PRIVATE-PATH-CANARY/missing.json'],'');assert.equal(r.status,2);assert.equal(r.stdout,'');assert.doesNotMatch(r.stderr,/SYNTHETIC-PRIVATE-PATH-CANARY/);
});
test('CLI help returns immediately and explains uncertainty-aware exit codes',()=>{
  const r=run(['--help'],'');assert.equal(r.status,0);assert.match(r.stdout,/Usage:/);assert.match(r.stdout,/unknown|uncertain|uncertainty/i);assert.match(r.stdout,/--studies/);
});
