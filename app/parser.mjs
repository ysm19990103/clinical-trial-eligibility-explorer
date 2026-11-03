import { LIMITS, FIELDS } from './catalog.mjs';
export class ImportError extends Error {
  constructor(code,message,offset=null){super(message);this.name='ImportError';this.code=code;this.offset=offset;}
}
// A bounded JSON reader detects duplicate decoded keys before they can be overwritten.
// Errors contain positions and fixed messages, never input excerpts or filenames.
export function parseInput(text) {
  if(typeof text!=='string') throw new ImportError('input','Expected JSON text.');
  if(new TextEncoder().encode(text).length>LIMITS.bytes) throw new ImportError('limit','Input exceeds the 2 MiB limit.');
  if(text.charCodeAt(0)===0xfeff)text=text.slice(1);
  let i=0,nodes=0;
  const fail=(code,message)=>{throw new ImportError(code,message,i);};
  const space=()=>{while(/[\t\r\n ]/.test(text[i]||'~'))i++;};
  const string=()=>{
    const start=i++;let escaped=false;
    while(i<text.length){const ch=text[i++];if(ch==='"'&&!escaped){let result;try{result=JSON.parse(text.slice(start,i));}catch{fail('syntax','Invalid JSON string.');}if(result.length>LIMITS.string)fail('limit','A string exceeds the local parser limit.');return result;}if(ch==='\\'&&!escaped)escaped=true;else escaped=false;}
    fail('syntax','Unterminated JSON string.');
  };
  function value(depth){
    if(depth>LIMITS.depth)fail('limit','Input nesting exceeds the local depth limit.');
    if(++nodes>LIMITS.nodes)fail('limit','Input exceeds the local node limit.');
    space();const ch=text[i];
    if(ch==='"')return string();
    if(ch==='{'){
      i++;space();const out=Object.create(null),seen=new Set();if(text[i]==='}'){i++;return out;}
      while(i<text.length){space();if(text[i]!=='"')fail('syntax','An object key must be a JSON string.');const key=string();
        if(['__proto__','prototype','constructor'].includes(key))fail('security','A reserved object key is not accepted.');
        if(seen.has(key))fail('duplicate-key','Duplicate JSON keys are not accepted.');seen.add(key);space();if(text[i++]!==':')fail('syntax','Expected a colon after an object key.');out[key]=value(depth+1);space();const end=text[i++];if(end==='}')return out;if(end!==',')fail('syntax','Expected an object separator.');
      }fail('syntax','Unterminated JSON object.');
    }
    if(ch==='['){i++;space();const out=[];if(text[i]===']'){i++;return out;}while(i<text.length){out.push(value(depth+1));space();const end=text[i++];if(end===']')return out;if(end!==',')fail('syntax','Expected an array separator.');}fail('syntax','Unterminated JSON array.');}
    for(const [token,result] of [['true',true],['false',false],['null',null]])if(text.startsWith(token,i)){i+=token.length;return result;}
    const match=text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if(match){const literal=match[0];i+=literal.length;const number=Number(literal);const mantissa=literal.split(/[eE]/)[0].replace(/[-.]/g,'').replace(/^0+/,'');
      if(mantissa.length>15||!Number.isFinite(number)||(number===0&&/[1-9]/.test(mantissa)))fail('precision','Number exceeds the supported finite, 15-significant-digit precision limit.');
      return number;
    }
    fail('syntax','Invalid JSON value.');
  }
  const data=value(0);space();if(i!==text.length)fail('syntax','Unexpected content after the JSON value.');
  if(!data||typeof data!=='object'||Array.isArray(data))fail('shape','The root must be a JSON object.');
  return data;
}

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(o,k)=>Object.hasOwn(o,k);
const invalid=(message='The input does not match the supported schema.')=>{throw new ImportError('schema',message);};
const keys=(o,allowed)=>{if(!object(o)||Object.keys(o).some(k=>!allowed.includes(k)))invalid('Unexpected fields or incompatible object shape.');};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const date=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number),leap=y%4===0&&(y%100!==0||y%400===0);
  return y>=1&&m>=1&&m<=12&&d>=1&&d<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
};
const text=(value,max=500,required=false)=>{
  if(value===undefined&&!required)return '';
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))invalid('A text field is missing, incompatible, or exceeds its length limit.');
  return value.trim();
};
const token=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value))invalid('A study or criterion identifier has an unsupported format.');return value;};
const sourceURL=value=>{
  if(value===undefined||value==='')return '';
  if(typeof value!=='string'||value.length>1000||/[\u0000-\u0020\u007f\\]/.test(value))invalid('Only supported official HTTPS source links are accepted.');
  let u;try{u=new URL(value);}catch{invalid('Only supported official HTTPS source links are accepted.');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||!['clinicaltrials.gov','www.clinicaltrials.gov','cancer.gov','www.cancer.gov','clinical.nih.gov','www.clinical.nih.gov','cdn.clinicaltrials.gov','www.astrazenecaclinicaltrials.com','www.nlm.nih.gov'].includes(u.hostname)||u.search)invalid('Only supported official HTTPS source links are accepted.');
  return u.href;
};
const knownValue=(v,field)=>{
  if(field.kind==='number')return finite(v);
  if(field.kind==='boolean')return typeof v==='boolean';
  if(field.kind==='enum')return typeof v==='string'&&Array.isArray(field.options)&&field.options.some(option=>option.value===v);
  return false;
};
export function validateCase(input){
  keys(input,['schema','asOf','facts']);
  if(input.schema!=='eligibility-case.v1'||!date(input.asOf)||!object(input.facts))invalid('A supported case schema, full review date, and fact object are required.');
  const facts=Object.create(null);
  for(const [key,fact] of Object.entries(input.facts)){
    if(!own(FIELDS,key))invalid('An unsupported case field is present.');
    keys(fact,['value','unit','observedOn']);
    if(!own(fact,'value'))invalid('A fact must explicitly contain a value or null.');
    const field=FIELDS[key];
    if(fact.value!==null){
      if(!knownValue(fact.value,field))invalid('A fact has an unsupported value type or category.');
      if(field.kind==='number'&&((finite(field.min)&&fact.value<field.min)||(finite(field.max)&&fact.value>field.max)||(field.step===1&&!Number.isInteger(fact.value))))invalid('A numeric fact is outside the supported range or precision.');
    }
    const next={value:fact.value};
    if(own(fact,'unit')){if(typeof fact.unit!=='string'||fact.unit.length>30||/[\u0000-\u001f\u007f]/.test(fact.unit))invalid('A unit has an unsupported representation.');next.unit=fact.unit;}
    if(own(fact,'observedOn')){if(!date(fact.observedOn))invalid('An observation date must be a valid full calendar date.');next.observedOn=fact.observedOn;}
    facts[key]=next;
  }
  return {schema:'eligibility-case.v1',asOf:input.asOf,facts};
}
export function validateStudyPack(input){
  keys(input,['schema','studies']);
  if(input.schema!=='eligibility-study-pack.v1'||!Array.isArray(input.studies)||!input.studies.length||input.studies.length>(LIMITS.studies||20))invalid('A study pack must contain between one and twenty studies.');
  const ids=new Set();
  return input.studies.map(study=>{
    keys(study,['id','title','shortTitle','condition','phase','status','sourceDate','reviewedOn','sourceUrl','provenance','coverageNote','criteria','eligibilityText']);
    const id=token(study.id);if(ids.has(id))invalid('Study identifiers must be unique.');ids.add(id);
    if(!Array.isArray(study.criteria)||!study.criteria.length||study.criteria.length>(LIMITS.criteria||60))invalid('A study must contain between one and sixty criteria.');
    let nodeCount=0;const criterionIds=new Set();
    function rule(node,depth=0){
      if(!object(node)||depth>(LIMITS.ruleDepth||8)||++nodeCount>(LIMITS.ruleNodes||200))invalid('The rule tree exceeds supported structural limits.');
      if(node.op==='manual'){keys(node,['op','reason']);return {op:'manual',...(own(node,'reason')?{reason:text(node.reason)}:{})};}
      if(node.op==='all'||node.op==='any'){
        keys(node,['op','children']);if(!Array.isArray(node.children)||!node.children.length||node.children.length>60)invalid('Rule groups must contain a bounded nonempty list of children.');
        return {op:node.op,children:node.children.map(n=>rule(n,depth+1))};
      }
      if(node.op==='not'){keys(node,['op','child']);return {op:'not',child:rule(node.child,depth+1)};}
      if(node.op!=='compare')invalid('An unsupported rule operation is present.');
      keys(node,['op','field','comparator','value','unit','maxAgeDays']);
      if(typeof node.field!=='string'||!own(FIELDS,node.field))invalid('A rule refers to an unsupported case field.');
      const field=FIELDS[node.field];
      if(!['gte','gt','lte','lt','eq','in'].includes(node.comparator)||(field.kind!=='number'&&!['eq','in'].includes(node.comparator)))invalid('A rule comparator is incompatible with its field.');
      const values=node.comparator==='in'?node.value:[node.value];
      if(!Array.isArray(values)||!values.length||values.length>(LIMITS.inOptions||20)||values.some(v=>!knownValue(v,field)))invalid('A rule has incompatible comparison values.');
      const out={op:'compare',field:node.field,comparator:node.comparator,value:Array.isArray(node.value)?[...node.value]:node.value};
      if(own(node,'unit')){
        if(typeof node.unit!=='string'||node.unit.length>30||node.unit!==field.unit)invalid('A rule unit must match the declared field unit.');out.unit=node.unit;
      }else if(field.unit)out.unit=field.unit;
      if(own(node,'maxAgeDays')){
        if(!Number.isInteger(node.maxAgeDays)||node.maxAgeDays<0||node.maxAgeDays>3650)invalid('An evidence age window is outside the supported range.');out.maxAgeDays=node.maxAgeDays;
      }
      return out;
    }
    const criteria=study.criteria.map(criterion=>{
      keys(criterion,['id','kind','label','note','sourceUrl','rule']);
      const id=token(criterion.id);if(criterionIds.has(id))invalid('Criterion identifiers must be unique within a study.');criterionIds.add(id);
      if(!['inclusion','exclusion'].includes(criterion.kind))invalid('A criterion requires explicit inclusion or exclusion polarity.');
      return {id,kind:criterion.kind,label:text(criterion.label,500,true),note:text(criterion.note),sourceUrl:sourceURL(criterion.sourceUrl),rule:rule(criterion.rule)};
    });
    // Imported rules are selected abstractions, not a complete protocol representation.
    if(!criteria.some(c=>c.rule.op==='manual')){
      if(criteria.length>=(LIMITS.criteria||60)||nodeCount>=(LIMITS.ruleNodes||200))invalid('A study must leave room for its mandatory unmodeled-protocol review criterion.');
      let guard='remaining-protocol',suffix=2;while(criterionIds.has(guard))guard='remaining-protocol-'+suffix++;
      criteria.push({id:guard,kind:'inclusion',label:'Remaining protocol and investigator review',note:'Imported rules do not establish complete protocol coverage.',sourceUrl:'',rule:{op:'manual'}});
    }
    const sourceDate=text(study.sourceDate,10),reviewedOn=text(study.reviewedOn,10);
    if((sourceDate&&!date(sourceDate))||(reviewedOn&&!date(reviewedOn)))invalid('Study provenance dates must use full calendar dates.');
    if(own(study,'provenance')&&!['public-curated','synthetic','registry-import','local-pack'].includes(study.provenance))invalid('Unsupported provenance marker.');
    return {id,title:text(study.title,500,true),shortTitle:text(study.shortTitle,500)||text(study.title,500,true),condition:text(study.condition,500),phase:text(study.phase,100),status:text(study.status,100)||'Not supplied',sourceDate,reviewedOn,sourceUrl:sourceURL(study.sourceUrl),provenance:'local-pack',coverageNote:'Selected imported rules only. Remaining protocol requirements require manual review.',criteria,...(own(study,'eligibilityText')?{eligibilityText:text(study.eligibilityText,20000)}:{})};
  });
}
