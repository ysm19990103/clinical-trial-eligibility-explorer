export const SCENARIOS=Object.freeze({
 baseline:{title:'Advanced disease · documented case',description:'Synthetic advanced NSCLC context with explicit known facts. Unmapped protocol requirements remain unknown.'},
 missing:{title:'Incomplete referral',description:'Sparse synthetic evidence demonstrates why missing data must not count as a pass.'},
 barriers:{title:'Conflicting criteria',description:'Synthetic facts that conflict with several selected public eligibility requirements.'},
 stale:{title:'Laboratory evidence review',description:'The fictional sandbox combines a stale result, a unit mismatch and an unknown clinical fact.'}
});
const measured=(value,unit,observedOn)=>({value,unit,...(observedOn?{observedOn}:{})});
const simple=value=>({value});
function base(){return {schema:'eligibility-case.v1',asOf:'2026-11-03',facts:{
 age:measured(56,'years'),sex:simple('female'),disease:simple('nsclc'),histology:simple('adenocarcinoma'),stage:simple('stage_iv'),
 curativeLocalTherapy:simple(false),resected:simple(false),measurable:simple(true),ecog:measured(1,'ECOG'),whops:measured(1,'WHO PS'),
 egfr:simple('not_detected'),alk:simple('negative'),egfrAlkTherapyIndicated:simple(false),priorSystemic:simple(false),priorEgfrTki:simple(false),
 activeCns:simple(false),activeAutoimmune:simple(false),systemicImmunosuppression:simple(false),interstitialLungDisease:simple(false),
 anc:measured(2.1,'10^9/L','2026-11-01'),platelets:measured(160,'10^9/L','2026-11-01'),hemoglobin:measured(11.4,'g/dL','2026-11-01'),creatinineClearance:measured(72,'mL/min','2026-11-01'),daysSinceTherapy:measured(35,'days')
}};}
export function scenario(key){
 if(!Object.hasOwn(SCENARIOS,key))throw new Error('Unknown synthetic scenario.');
 const c=base();
 if(key==='missing')c.facts={age:measured(56,'years'),disease:simple('nsclc'),histology:simple('adenocarcinoma')};
 if(key==='barriers'){c.facts.ecog=measured(3,'ECOG');c.facts.whops=measured(3,'WHO PS');c.facts.priorSystemic=simple(true);c.facts.egfr=simple('l858r');c.facts.egfrAlkTherapyIndicated=simple(true);c.facts.activeAutoimmune=simple(true);c.facts.systemicImmunosuppression=simple(true);}
 if(key==='stale'){c.facts.anc=measured(2.1,'10^9/L','2026-10-01');c.facts.hemoglobin=measured(11.4,'g/L','2026-11-01');delete c.facts.creatinineClearance;delete c.facts.activeCns;}
 return c;
}
