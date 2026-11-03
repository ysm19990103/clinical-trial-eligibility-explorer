import {FIELDS} from './catalog.mjs';
import {ImportError,parseNumberLiteral,validateCase} from './parser.mjs';

// FormData contains original decimal text, before JavaScript numeric coercion.
export function caseFromForm(form){
  const facts={};
  for(const [key,field] of Object.entries(FIELDS)){
    const raw=form.get(key);let value=null;
    if(raw!==null&&raw!==''){
      if(typeof raw!=='string')throw new ImportError('schema','A case field has an unsupported representation.');
      if(field.kind==='number')value=parseNumberLiteral(raw);
      else if(field.kind==='boolean'){
        if(raw!=='true'&&raw!=='false')throw new ImportError('schema','A boolean field must be yes, no, or unknown.');
        value=raw==='true';
      }else value=raw;
    }
    const fact={value},unit=form.get(key+'__unit'),date=form.get(key+'__date');
    if(unit!==null&&unit!=='')fact.unit=unit;
    if(date!==null&&date!=='')fact.observedOn=date;
    facts[key]=fact;
  }
  return validateCase({schema:'eligibility-case.v1',asOf:form.get('asOf'),facts});
}
