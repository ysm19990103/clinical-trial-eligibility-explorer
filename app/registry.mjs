import {ImportError,validateStudyPack} from './parser.mjs';
import {LIMITS} from './catalog.mjs';
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=()=>{throw new ImportError('registry','Unsupported ClinicalTrials.gov v2 study JSON. Use a study object or a studies array within the local limits.');};
const text=(v,max=500)=>{if(v===undefined)return '';if(typeof v!=='string'||v.length>max)fail();return v;};
const fullDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';
const compare=(field,comparator,value,unit)=>({op:'compare',field,comparator,value,...(unit?{unit}:{})});
const criterion=(id,label,rule,note='')=>({id,kind:'inclusion',label,rule,note});
export function importRegistry(input){
 const raw=Array.isArray(input?.studies)?input.studies:[input];
 if(!raw.length||raw.length>LIMITS.studies)fail();
 const studies=raw.map(study=>{
  const p=study?.protocolSection;if(!obj(p)||!obj(p.identificationModule))fail();
  const nct=p.identificationModule.nctId;if(typeof nct!=='string'||!/^NCT\d{8}$/.test(nct))fail();
  const eligibility=p.eligibilityModule;if(!obj(eligibility))fail();
  const criteria=[];
  for(const [key,comparator,label] of [['minimumAge','gte','Registry minimum age'],['maximumAge','lte','Registry maximum age']]){
   const value=eligibility[key];
   if(value==='N/A')continue;
   const match=typeof value==='string'?value.match(/^(\d+) Years$/):null;
   if(match&&Number(match[1])<=130){criteria.push(criterion(key,label,compare('age',comparator,Number(match[1]),'years'),'Registry demographic field only; protocol-specific age qualifications may differ.'));}
   else criteria.push(criterion(key,label,{op:'manual',reason:'Age bound is missing or not modeled in years.'},'Months, weeks, days, missing or unrecognized bounds are not converted.'));
  }
  if(eligibility.sex==='MALE'||eligibility.sex==='FEMALE')criteria.push(criterion('registry-sex','Registry sex requirement',compare('sex','eq',eligibility.sex.toLowerCase()),'Uses the registry sex field, without inferring gender identity.'));
  else if(eligibility.sex!=='ALL')criteria.push(criterion('registry-sex','Registry sex requirement',{op:'manual',reason:'Registry sex field is absent or unrecognized.'}));
  if(eligibility.genderBased===true)criteria.push(criterion('gender-provisions','Additional gender-related protocol provisions',{op:'manual',reason:'Protocol gender provisions require source review.'}));
  criteria.push(criterion('remaining-protocol','Full eligibility text and other requirements',{op:'manual',reason:'Free-text eligibility is not automatically translated into executable rules.'},'No disease, laboratory, treatment, consent or exception logic is inferred from free text.'));
  return {id:nct,title:text(p.identificationModule.briefTitle)||'Imported public registry study',shortTitle:nct,condition:Array.isArray(p.conditionsModule?.conditions)?text(p.conditionsModule.conditions.slice(0,3).join(' · ')):'Not specified',phase:Array.isArray(p.designModule?.phases)?text(p.designModule.phases.join(' / ')):'Not specified',status:text(p.statusModule?.overallStatus)||'Not supplied',sourceDate:fullDate(p.statusModule?.lastUpdatePostDateStruct?.date),reviewedOn:'',sourceUrl:`https://clinicaltrials.gov/study/${nct}`,provenance:'registry-import',coverageNote:'Imported snapshot, not a live registry query. Only recognized year-based age limits and sex fields receive basic mappings. All clinical eligibility text remains manual.',eligibilityText:text(eligibility.eligibilityCriteria,LIMITS.sourceText),criteria};
 });
 const checked=validateStudyPack({schema:'eligibility-study-pack.v1',studies});
 return checked.map(study=>({...study,provenance:'registry-import'}));
}
