import {VERSION,RULESET,FIELDS} from './catalog.mjs';
import {REASONS} from './engine.mjs';
const NOTICE='Selected criteria only. This report is not an eligibility or enrollment decision. Case values, trial titles, original identifiers, source text and filenames are omitted. Structural findings can still be sensitive.';
const own=(o,k)=>Object.hasOwn(o,k);
const decisions=new Set(['meets','does_not_meet','unknown']);
const truths=new Set(['true','false','unknown']);
const textFor=code=>own(REASONS,code)?REASONS[code]:'This item requires review.';
const fieldName=key=>typeof key==='string'&&own(FIELDS,key)?FIELDS[key].label:null;
function safeTree(tree,depth=0){
 if(!tree||depth>8)return {operation:'manual',truth:'unknown',reason:'This item requires review.'};
 return {operation:['all','any','not','compare','manual'].includes(tree.op)?tree.op:'manual',truth:truths.has(tree.truth)?tree.truth:'unknown',reason:textFor(tree.reasonCode),...(fieldName(tree.field)?{field:fieldName(tree.field)}:{}),...(Array.isArray(tree.children)?{children:tree.children.slice(0,60).map(c=>safeTree(c,depth+1))}:{})};
}
export function reportModel(studies,caseData,results){
 return {schema:'eligibility-review.v1',version:VERSION,ruleset:RULESET,reviewDate:/^\d{4}-\d{2}-\d{2}$/.test(caseData?.asOf||'')?caseData.asOf:'Not supplied',notice:NOTICE,studies:results.slice(0,20).map((r,i)=>{
  const criteria=(r.criteria||[]).slice(0,60).map((c,j)=>({alias:`C${String(j+1).padStart(2,'0')}`,kind:c.kind==='exclusion'?'exclusion':'inclusion',decision:decisions.has(c.status)?c.status:'unknown',predicate:truths.has(c.predicate)?c.predicate:'unknown',reason:textFor(c.reasonCode),fields:[...new Set((c.facts||[]).map(fieldName).filter(Boolean))],logic:safeTree(c.tree)}));
  const counts={meets:0,does_not_meet:0,unknown:0};for(const c of criteria)counts[c.decision]++;
  return {alias:`T${String(i+1).padStart(3,'0')}`,provenance:['public-curated','synthetic','registry-import','local-pack'].includes(studies[i]?.provenance)?studies[i].provenance:'local-pack',scope:'Selected subset; remaining protocol review required',decision:counts.does_not_meet?'does_not_meet':counts.unknown||!criteria.length?'unknown':'meets',counts,criteria};
 })};
}
export const reportJSON=(studies,c,r)=>JSON.stringify(reportModel(studies,c,r),null,2)+'\n';
const csvCell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
export function reportCSV(studies,c,r){
 const model=reportModel(studies,c,r),rows=[['study_alias','criterion_alias','kind','decision','predicate','fields','reason'],['summary','','coverage','unknown','','',NOTICE]];
 for(const study of model.studies)for(const criterion of study.criteria)rows.push([study.alias,criterion.alias,criterion.kind,criterion.decision,criterion.predicate,criterion.fields.join(' / '),criterion.reason]);
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label={meets:'Meets selected check',does_not_meet:'Does not meet selected check',unknown:'Unknown / manual review'};
export function reportHTML(studies,c,r){
 const model=reportModel(studies,c,r);
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Clinical trial criterion review</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f6f5ef;color:#173c31;margin:0}main{max-width:1040px;margin:auto;padding:40px 24px}h1{font-size:34px}h2{font-size:23px}.notice,article{background:#fff;border:1px solid #d7ded5;padding:22px;margin:24px 0;border-radius:10px}.overline{font-size:12px;letter-spacing:.12em;text-transform:uppercase}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:12px 8px;border-bottom:1px solid #d7ded5;text-align:left;vertical-align:top}.meta{color:#5d6b62;font-size:13px}@media print{body{background:white}main{padding:0}article{break-inside:avoid}tr{break-inside:avoid}}</style></head><body><main><p class="overline">Clinical Trial Eligibility Explorer</p><h1>Selected criterion review</h1><p>${escape(model.ruleset)} · Review date ${escape(model.reviewDate)}</p><div class="notice">${escape(NOTICE)}</div>${model.studies.map(s=>`<article><h2>${s.alias} · ${label[s.decision]}</h2><p class="meta">${s.provenance} · ${s.counts.meets} met · ${s.counts.does_not_meet} not met · ${s.counts.unknown} unknown</p><table><thead><tr><th>Criterion</th><th>Result</th><th>Fields</th><th>Reason</th></tr></thead><tbody>${s.criteria.map(c=>`<tr><td>${c.alias}<br>${c.kind}</td><td>${label[c.decision]}</td><td>${c.fields.map(escape).join('<br>')}</td><td>${escape(c.reason)}</td></tr>`).join('')}</tbody></table></article>`).join('')}<p class="meta">Aliases refer to positions in the reviewed study list. Use the local workspace to relate them to criteria; the report deliberately omits imported labels and patient values.</p></main></body></html>`;
}
