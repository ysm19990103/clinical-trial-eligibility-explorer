// Authored, selected-clause mappings. Not complete protocols or a live recruitment feed.
const cmp=(field,comparator,value,unit)=>({op:'compare',field,comparator,value,...(unit?{unit}:{})});
const all=(...children)=>({op:'all',children});
const any=(...children)=>({op:'any',children});
const manual=reason=>({op:'manual',reason});
const inc=(id,label,rule,note='')=>({id,kind:'inclusion',label,rule,note});
const exc=(id,label,rule,note='')=>({id,kind:'exclusion',label,rule,note});
const rest=()=>inc('remaining-protocol','Remaining protocol requirements',manual('Unmapped protocol requirements need investigator review.'),'Consent, organ function, clinical exceptions, timing, assay confirmation and other eligibility requirements are not fully mapped.');
const age=()=>cmp('age','gte',18,'years');
const nonSquamous=()=>all(cmp('disease','eq','nsclc'),cmp('histology','in',['adenocarcinoma','nonsquamous']));
const egfr=()=>any(cmp('egfr','eq','exon19del'),cmp('egfr','eq','l858r'));
export const STUDIES=[
 {id:'NCT02578680',shortTitle:'KEYNOTE-189',title:'Pembrolizumab plus chemotherapy in untreated metastatic nonsquamous NSCLC',condition:'Metastatic nonsquamous NSCLC',phase:'Phase 3',status:'Completed · historical example',sourceDate:'2024-09-20',reviewedOn:'2026-11-03',sourceUrl:'https://clinicaltrials.gov/study/NCT02578680',provenance:'public-curated',coverageNote:'Selected registry clauses, paraphrased. Source date is the registry last-update date. This study is a historical teaching example; no enrollment recommendation is made.',criteria:[
 inc('adult','Age at least 18 years',age()),
 inc('population','Stage IV nonsquamous NSCLC',all(nonSquamous(),cmp('stage','eq','stage_iv'))),
 inc('targeted-therapy','EGFR/ALK-directed treatment not indicated',cmp('egfrAlkTherapyIndicated','eq',false),'Requires an explicit clinical determination; absent testing does not mean negative.'),
 inc('measurable','Measurable disease',cmp('measurable','eq',true),'RECIST and source imaging review remain outside this selected check.'),
 inc('untreated','No systemic treatment for advanced/metastatic disease',cmp('priorSystemic','eq',false),'Treatment setting matters; do not automatically count adjuvant therapy here.'),
 inc('performance','ECOG performance status 0–1',cmp('ecog','in',[0,1],'ECOG')),
 inc('exceptions','CNS, autoimmune and immunosuppression provisions',manual('Conditional exclusions and exceptions require full source review.'),'A single diagnosis or boolean cannot capture the complete exclusions and their qualifiers.'),rest()
 ]},
 {id:'NCT02296125',shortTitle:'FLAURA',title:'First-line osimertinib versus earlier EGFR inhibitors in advanced NSCLC',condition:'EGFR-mutated advanced NSCLC',phase:'Phase 3',status:'Completed · historical example',sourceDate:'2026-04-21',reviewedOn:'2026-11-03',sourceUrl:'https://clinicaltrials.gov/study/NCT02296125',provenance:'public-curated',coverageNote:'Selected registry clauses, paraphrased. Source date is the registry last-update date. WHO performance status is not automatically substituted with ECOG.',criteria:[
 inc('age-range','Registry age range 18–100 years',all(age(),cmp('age','lte',100,'years')),'Registry demographic bounds only; applicable protocol qualifications remain unassessed.'),
 inc('population','Advanced lung adenocarcinoma without curative local treatment',all(cmp('disease','eq','nsclc'),cmp('histology','eq','adenocarcinoma'),cmp('stage','in',['stage_iv','locally_advanced']),cmp('curativeLocalTherapy','eq',false))),
 inc('egfr','EGFR exon 19 deletion or L858R',egfr(),'Assay eligibility and other mutation combinations need protocol review.'),
 inc('untreated','No systemic treatment for advanced/metastatic disease',cmp('priorSystemic','eq',false),'Prior adjuvant or neoadjuvant treatment is not automatically disqualifying.'),
 inc('performance','WHO performance status 0–1',cmp('whops','in',[0,1],'WHO PS')),
 inc('performance-stability','Performance stability during the previous two weeks',manual('The required stability interval is not represented by a single performance score.')),
 exc('prior-tki','Prior EGFR tyrosine kinase inhibitor',cmp('priorEgfrTki','eq',true)),
 inc('cns-exceptions','CNS disease and treated/stable exceptions',manual('Treatment, stability and steroid qualifications require source review.')),rest()
 ]},
 {id:'NCT02511106',shortTitle:'ADAURA',title:'Adjuvant osimertinib after resection of EGFR-mutated NSCLC',condition:'Resected EGFR-mutated NSCLC',phase:'Phase 3',status:'Recruitment complete · sponsor snapshot',sourceDate:'2021-01-08',reviewedOn:'2026-11-03',sourceUrl:'https://clinicaltrials.gov/study/NCT02511106',provenance:'public-curated',coverageNote:'Selected protocol edition 5.0 (source date), section 3.1. Recruitment label comes from the sponsor page reviewed 2026-11-03; the current registry-update date was not verified. Not a recruiting recommendation.',criteria:[
 inc('age','General adult age floor and country qualification',all(age(),manual('Japan/Taiwan minimum age and applicable country rules require review.')),'Protocol minimum is 20 in Japan/Taiwan; jurisdiction is intentionally not collected.'),
 inc('population','Nonsquamous NSCLC in the protocol TNM 7 stage grouping',all(nonSquamous(),cmp('stage','eq','ib_ii_iiia_tnm7')),'Postoperative pathologic stage IB, II or IIIA under the seventh edition; no edition conversion is performed.'),
 inc('resection','Documented complete R0 resection',cmp('resected','eq',true),'Procedure, recovery and timing must still be confirmed.'),
 inc('egfr','Qualifying EGFR variant with central confirmation',all(egfr(),manual('Central laboratory confirmation remains unassessed.')),'A qualifying variant alone does not establish central confirmation; permitted combinations need protocol review.'),
 inc('performance','WHO performance status 0–1',cmp('whops','in',[0,1],'WHO PS')),
 inc('timing','Surgery, optional adjuvant chemotherapy and recovery windows',manual('Treatment-specific timing branches require source review.'),'Postoperative adjuvant chemotherapy is permitted; no blanket prior-treatment exclusion is inferred.'),rest()
 ].map(c=>({...c,sourceUrl:'https://cdn.clinicaltrials.gov/large-docs/06/NCT02511106/Prot_000.pdf'}))},
 {id:'SYNTHETIC-LAB',shortTitle:'Laboratory sandbox',title:'Fictional protocol for testing evidence dates and logical groups',condition:'Synthetic learning exercise',phase:'Not a clinical trial',status:'Fictional · no enrollment',sourceDate:'2026-11-03',reviewedOn:'2026-11-03',sourceUrl:'',provenance:'synthetic',coverageNote:'All thresholds and timing windows below are invented for software demonstration. They are not recommendations or criteria for any real study.',criteria:[
 inc('adult','Fictional age range 18–80',all(age(),cmp('age','lte',80,'years'))),
 inc('anc','Fictional ANC minimum with a 7-day evidence window',{...cmp('anc','gte',1.5,'10^9/L'),maxAgeDays:7}),
 inc('platelets','Fictional platelet minimum with a 7-day evidence window',{...cmp('platelets','gte',100,'10^9/L'),maxAgeDays:7}),
 inc('hemoglobin','Fictional hemoglobin minimum with a 7-day evidence window',{...cmp('hemoglobin','gte',9,'g/dL'),maxAgeDays:7}),
 inc('renal','Fictional creatinine-clearance minimum',{...cmp('creatinineClearance','gte',60,'mL/min'),maxAgeDays:14}),
 inc('washout','Fictional prior-treatment interval or no prior advanced therapy',any(cmp('priorSystemic','eq',false),cmp('daysSinceTherapy','gte',28,'days'))),
 exc('immune','Fictional combined autoimmune and immunosuppression exclusion',all(cmp('activeAutoimmune','eq',true),cmp('systemicImmunosuppression','eq',true))),
 inc('cns','Fictional absence of active symptomatic CNS disease',{op:'not',child:cmp('activeCns','eq',true)}),rest()
 ]}
];
export const STUDY_BY_ID=Object.fromEntries(STUDIES.map(s=>[s.id,s]));
