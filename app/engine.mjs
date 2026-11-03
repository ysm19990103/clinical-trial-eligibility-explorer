import {FIELDS,LIMITS} from './catalog.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(o,k)=>object(o)&&Object.hasOwn(o,k);
const T='true',F='false',U='unknown';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export const REASONS=Object.freeze({
  missing:'The required case fact is missing or explicitly unknown.',
  invalid:'The case fact has an unsupported type, category, or range.',
  unit:'The fact unit does not exactly match the required unit; no conversion is applied.',
  date:'The review or observation date is missing or invalid for this comparison.',
  future:'The observation date is after the review date.',
  stale:'The observation is older than the criterion’s permitted evidence window.',
  manual:'This criterion requires protocol-specific human review.',
  malformed:'This rule has an unsupported or malformed representation.',
  yes:'The supplied fact satisfies this comparison.',
  no:'The supplied fact does not satisfy this comparison.',
  allTrue:'Every condition in this AND group is satisfied.',
  allFalse:'At least one condition in this AND group is not satisfied.',
  allUnknown:'No condition is known to fail, but at least one condition is unknown.',
  anyTrue:'At least one condition in this OR group is satisfied.',
  anyFalse:'Every condition in this OR group is known to be unsatisfied.',
  anyUnknown:'No condition is known to pass, and at least one condition is unknown.',
  notTrue:'The negated condition is known to be false.',
  notFalse:'The negated condition is known to be true.',
  notUnknown:'Negating an unknown condition leaves it unknown.',
  inclusionTrue:'The selected inclusion requirement is met.',
  inclusionFalse:'The selected inclusion requirement is not met.',
  exclusionTrue:'The exclusion condition is present, so this requirement is not met.',
  exclusionFalse:'The exclusion condition is not present, so this requirement is met.',
  unknown:'There is insufficient reliable information to determine this requirement.'
});
function day(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const [y,m,d]=value.split('-').map(Number),leap=y%4===0&&(y%100!==0||y%400===0);
  if(y<1||m<1||m>12||d<1||d>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1])return null;
  const date=new Date(0);date.setUTCFullYear(y,m-1,d);date.setUTCHours(0,0,0,0);return date.getTime()/86400000;
}
function knownValue(value,field,range=true){
  if(field.kind==='boolean')return typeof value==='boolean';
  if(field.kind==='enum')return typeof value==='string'&&Array.isArray(field.options)&&field.options.some(o=>o.value===value);
  if(field.kind==='number')return finite(value)&&(!range||((!finite(field.min)||value>=field.min)&&(!finite(field.max)||value<=field.max)&&(field.step!==1||Number.isInteger(value))));
  return false;
}
const result=(op,truth,reasonCode,extra={})=>({op,truth,reason:REASONS[reasonCode],reasonCode,...extra});
export function evaluateStudy(study,caseData){
  const validCase=object(caseData)&&caseData.schema==='eligibility-case.v1'&&object(caseData.facts);
  const reviewDay=validCase?day(caseData.asOf):null;
  let nodes=0;
  function evaluate(node,depth=0,ancestors=new Set()){
    if(!object(node)||depth>(LIMITS.ruleDepth||8)||++nodes>(LIMITS.ruleNodes||200)||ancestors.has(node))return result('unknown',U,'malformed');
    const next=new Set(ancestors);next.add(node);
    const allowed={all:['op','children'],any:['op','children'],not:['op','child'],manual:['op','reason'],compare:['op','field','comparator','value','unit','maxAgeDays']};
    if(typeof node.op!=='string'||!Object.hasOwn(allowed,node.op)||Object.keys(node).some(k=>!allowed[node.op].includes(k)))return result('unknown',U,'malformed');
    if(node.op==='manual')return result('manual',U,'manual');
    if(node.op==='all'||node.op==='any'){
      if(!Array.isArray(node.children)||!node.children.length||node.children.length>60)return result(node.op,U,'malformed');
      const children=node.children.map(n=>evaluate(n,depth+1,next)),truths=children.map(n=>n.truth);
      const truth=node.op==='all'?(truths.includes(F)?F:truths.includes(U)?U:T):(truths.includes(T)?T:truths.includes(U)?U:F);
      return result(node.op,truth,node.op+(truth===T?'True':truth===F?'False':'Unknown'),{children});
    }
    if(node.op==='not'){
      const child=evaluate(node.child,depth+1,next),truth=child.truth===U?U:child.truth===T?F:T;
      return result('not',truth,'not'+(truth===T?'True':truth===F?'False':'Unknown'),{children:[child]});
    }
    if(typeof node.field!=='string'||!own(FIELDS,node.field))return result('compare',U,'malformed');
    const field=FIELDS[node.field],extra={field:node.field};
    if(!['gte','gt','lte','lt','eq','in'].includes(node.comparator)||(field.kind!=='number'&&!['eq','in'].includes(node.comparator)))return result('compare',U,'malformed',extra);
    const values=node.comparator==='in'?node.value:[node.value];
    if(!Array.isArray(values)||!values.length||values.length>(LIMITS.inOptions||20)||values.some(v=>!knownValue(v,field,false)))return result('compare',U,'malformed',extra);
    const unit=own(node,'unit')?node.unit:field.unit;
    if(own(node,'unit')&&(typeof node.unit!=='string'||node.unit!==field.unit))return result('compare',U,'malformed',extra);
    if(own(node,'maxAgeDays')&&(!Number.isInteger(node.maxAgeDays)||node.maxAgeDays<0||node.maxAgeDays>3650))return result('compare',U,'malformed',extra);
    if(!validCase||reviewDay===null)return result('compare',U,'date',extra);
    const fact=own(caseData.facts,node.field)?caseData.facts[node.field]:null;
    if(!fact||!own(fact,'value')||fact.value===null)return result('compare',U,'missing',extra);
    if(!object(fact)||Object.keys(fact).some(k=>!['value','unit','observedOn'].includes(k))||!knownValue(fact.value,field))return result('compare',U,'invalid',extra);
    if(unit!==undefined&&fact.unit!==unit)return result('compare',U,'unit',extra);
    if(unit===undefined&&own(fact,'unit')&&fact.unit!=='')return result('compare',U,'unit',extra);
    if(own(fact,'observedOn')||own(node,'maxAgeDays')){
      const observedDay=day(fact.observedOn);
      if(observedDay===null)return result('compare',U,'date',extra);
      if(observedDay>reviewDay)return result('compare',U,'future',extra);
      if(own(node,'maxAgeDays')&&reviewDay-observedDay>node.maxAgeDays)return result('compare',U,'stale',extra);
    }
    const v=fact.value,target=node.value;
    const matched=node.comparator==='eq'?v===target:node.comparator==='in'?target.includes(v):node.comparator==='gte'?v>=target:node.comparator==='gt'?v>target:node.comparator==='lte'?v<=target:v<target;
    return result('compare',matched?T:F,matched?'yes':'no',extra);
  }
  const sourceCriteria=object(study)&&Array.isArray(study.criteria)&&study.criteria.length&&study.criteria.length<=(LIMITS.criteria||60)?study.criteria:null;
  const criteria=(sourceCriteria||[{id:'unsupported-review',kind:'inclusion',label:'Unsupported study representation',rule:{op:'manual'}}]).map((c,i)=>{
    const valid=object(c)&&['inclusion','exclusion'].includes(c.kind);
    const tree=valid?evaluate(c.rule):result('unknown',U,'malformed');
    const predicate=tree.truth,kind=valid?c.kind:'inclusion';
    const status=predicate===U?'unknown':(kind==='inclusion'?predicate===T:predicate===F)?'meets':'does_not_meet';
    const reasonCode=predicate===U?'unknown':kind+(predicate===T?'True':'False');
    const fields=new Set();function walk(n){if(n.field)fields.add(n.field);for(const child of n.children||[])walk(child);}walk(tree);
    return {id:typeof c?.id==='string'?c.id:`C${String(i+1).padStart(2,'0')}`,kind,label:typeof c?.label==='string'?c.label:'Unsupported criterion',status,predicate,reason:REASONS[reasonCode],reasonCode,facts:[...fields],tree};
  });
  const counts={meets:0,does_not_meet:0,unknown:0};for(const c of criteria)counts[c.status]++;
  return {id:typeof study?.id==='string'?study.id:'unsupported-study',status:counts.does_not_meet?'does_not_meet':counts.unknown?'unknown':'meets',counts,criteria,coverage:'selected-subset'};
}
export function evaluateAll(studies,caseData){
  if(!Array.isArray(studies)||studies.length>(LIMITS.studies||20))return [evaluateStudy(null,caseData)];
  return studies.map((study,index)=>({...evaluateStudy(study,caseData),alias:`T${String(index+1).padStart(3,'0')}`}));
}
export function countManualCriteria(criteria){
  const hasManual=(node,depth=0)=>Boolean(node&&depth<=LIMITS.ruleDepth&&(node.op==='manual'||(node.children||[]).some(child=>hasManual(child,depth+1))));
  return criteria.filter(criterion=>hasManual(criterion.tree)).length;
}
