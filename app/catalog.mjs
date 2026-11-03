export const VERSION='1.0.1';
export const RULESET='eligibility-selected-2026-11-03';
export const LIMITS=Object.freeze({bytes:2097152,depth:40,nodes:100000,string:131072,studies:20,criteria:60,ruleDepth:8,ruleNodes:200,sourceText:20000});
const options=items=>items.map(([value,label])=>({value,label}));
const number=(label,group,unit,min,max,help='',step='any')=>({label,group,kind:'number',unit,min,max,help,step});
const bool=(label,group,help='')=>({label,group,kind:'boolean',help});
const enumeration=(label,group,items,help='')=>({label,group,kind:'enum',options:options(items),help});
export const FIELDS=Object.freeze({
 age:number('Age at screening','Demographics','years',0,130,'Completed age in years; no birth date is collected.',1),
 sex:enumeration('Sex used by the protocol','Demographics',[['female','Female'],['male','Male'],['other','Another / not represented']],'Use the protocol definition. This field is separate from gender identity.'),
 disease:enumeration('Disease category','Disease context',[['nsclc','Non-small cell lung cancer'],['other','Other disease']]),
 histology:enumeration('Histology','Disease context',[['adenocarcinoma','Adenocarcinoma'],['nonsquamous','Other nonsquamous NSCLC'],['squamous','Squamous NSCLC'],['other','Other histology']]),
 stage:enumeration('Protocol stage grouping','Disease context',[['stage_iv','Stage IV'],['locally_advanced','Locally advanced'],['ib_ii_iiia_tnm7','Postoperative pathologic IB / II / IIIA (TNM 7)'],['other','Other grouping']],'Do not translate between TNM editions automatically. Select only a confirmed grouping.'),
 curativeLocalTherapy:bool('Suitable for curative surgery or radiotherapy','Disease context','A protocol-specific clinical judgment; uncertainty stays unknown.'),
 resected:bool('Complete R0 resection documented','Disease context','This does not establish required timing, recovery or all staging criteria.'),
 measurable:bool('Measurable disease documented','Disease context','Protocol-specific measurement requirements still require source review.'),
 ecog:number('ECOG performance status','Performance & biomarkers','ECOG',0,5,'Enter an ECOG assessment only.',1),
 whops:number('WHO performance status','Performance & biomarkers','WHO PS',0,5,'Kept separate from ECOG; stability and investigator review remain manual.',1),
 egfr:enumeration('EGFR mutation finding','Performance & biomarkers',[['exon19del','Exon 19 deletion present (alone or with other variants)'],['l858r','L858R present (alone or with other variants)'],['other','Confirmed neither exon 19 deletion nor L858R'],['not_detected','Not detected']],'Assay method, central confirmation and trial-specific interpretation are separate requirements.'),
 alk:enumeration('ALK finding','Performance & biomarkers',[['positive','Positive'],['negative','Negative']],'Not assessed is unknown, not negative.'),
 egfrAlkTherapyIndicated:bool('EGFR- or ALK-directed therapy indicated','Performance & biomarkers','Use an explicit clinical determination. This is not inferred from missing test results.'),
 priorSystemic:bool('Prior systemic therapy for advanced/metastatic disease','Treatment history','Adjuvant and neoadjuvant treatment must be reviewed separately; do not count them here automatically.'),
 priorEgfrTki:bool('Prior EGFR tyrosine kinase inhibitor','Treatment history'),
 activeCns:bool('Active symptomatic CNS disease','Clinical context','A sandbox fact only. Public trials may permit treated stable CNS disease; the full exception remains manual.'),
 activeAutoimmune:bool('Active autoimmune disease','Clinical context','Demonstrates a sandbox predicate; this alone is not a public-trial exclusion decision.'),
 systemicImmunosuppression:bool('Systemic immunosuppression','Clinical context'),
 interstitialLungDisease:bool('Interstitial lung disease history','Clinical context'),
 anc:number('Absolute neutrophil count','Laboratory sandbox','10^9/L',0,100,'Exact unit required; no conversion is applied. Fictional sandbox threshold only.'),
 platelets:number('Platelet count','Laboratory sandbox','10^9/L',0,3000,'Exact unit required; no conversion is applied.'),
 hemoglobin:number('Hemoglobin','Laboratory sandbox','g/dL',0,30,'Exact unit required; no conversion is applied.'),
 creatinineClearance:number('Documented creatinine clearance','Laboratory sandbox','mL/min',0,300,'No clearance formula is calculated. Fictional sandbox threshold only.'),
 daysSinceTherapy:number('Days since prior therapy','Laboratory sandbox','days',0,3650,'A supplied interval for the fictional sandbox; actual washout rules depend on treatment.',1)
});
export const SOURCES=Object.freeze({
 registry:{title:'ClinicalTrials.gov · Study record data structure',url:'https://clinicaltrials.gov/data-api/about-api/study-data-structure'},
 definitions:{title:'ClinicalTrials.gov · Eligibility data definitions',url:'https://clinicaltrials.gov/policy/protocol-definitions'},
 api:{title:'NLM · ClinicalTrials.gov API v2',url:'https://www.nlm.nih.gov/pubs/techbull/ma24/ma24_clinicaltrials_api.html'},
 participation:{title:'NCI · How clinical trials work',url:'https://www.cancer.gov/research/participate/clinical-trials/how-trials-work'},
 searching:{title:'NCI · Understanding trial descriptions',url:'https://www.cancer.gov/research/participate/clinical-trials-search/help'}
});
