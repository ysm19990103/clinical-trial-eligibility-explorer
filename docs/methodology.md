# Methodology and limitations

The explorer compares a synthetic case with **selected, explicitly encoded criteria**. It does not estimate enrollment probability or replace protocol review. A source-linked mapping can still be incomplete, outdated, or inapplicable to a particular site or amendment.

## Three-state reasoning

Each rule node evaluates to true, false, or unknown. Missing evidence is not false, and an unknown value is not a pass. The supported operations are numeric/typed comparisons, membership, `all` (AND), `any` (OR), `not`, and manual review.

| A | B | A AND B | A OR B |
| --- | --- | --- | --- |
| True | True | True | True |
| True | False | False | True |
| True | Unknown | Unknown | True |
| False | True | False | True |
| False | False | False | False |
| False | Unknown | False | Unknown |
| Unknown | True | Unknown | True |
| Unknown | False | False | Unknown |
| Unknown | Unknown | Unknown | Unknown |

NOT reverses true and false and preserves unknown. Empty or unsupported rule groups are not interpreted as successful matches. A manual requirement remains unknown.

Criterion polarity is applied after evaluating its rule:

| Predicate result | Inclusion criterion | Exclusion criterion |
| --- | --- | --- |
| True | Meets selected criterion | Does not meet selected criterion; exclusion triggered |
| False | Does not meet selected criterion | Meets selected criterion; exclusion not triggered |
| Unknown | Unknown | Unknown |

Study summaries retain all criteria. Any selected-criterion conflict produces a barrier. Without a conflict, any unknown requirement produces a needs-review result. Only when all modeled requirements meet their rules is the result “selected checks met.” That label does not establish full eligibility.

## Evidence handling

The case schema uses known fields, explicit value types, units, and an assessment date. Numerical strings are not silently converted to numbers, and missing boolean values are not converted to false. The evaluator does not impute facts, reinterpret biomarkers, calculate creatinine clearance, convert units, or translate between staging editions.

Where a rule specifies an evidence-age window, the observation date is compared with the case assessment date. The maximum permitted age is inclusive. Missing, invalid, future-dated, stale, or wrong-unit evidence is treated as unknown where it cannot support the comparison. Evidence outside a bounded schema may be rejected before evaluation.

ECOG and WHO performance status are separate fields. Prior systemic treatment for advanced/metastatic disease is distinguished from adjuvant or neoadjuvant treatment. A negative test, an unperformed test, and a clinical determination that targeted therapy is not indicated are different facts. The EGFR fields distinguish a qualifying exon-19 deletion or L858R present alone or with other variants from a confirmed absence of both qualifying variants. They do not establish central laboratory confirmation. Grouped stage values are used only in their stated protocol context; the ADAURA grouping specifically means postoperative pathologic stage IB, II, or IIIA under TNM seventh edition.

The laboratory sandbox uses fictional thresholds and windows to demonstrate these mechanisms. They are not substituted for the organ-function requirements of any public trial.

The comparison table counts each criterion containing a manual rule once, including manual nodes nested in AND, OR, or NOT groups. This count describes review coverage, not the number of unknown results; a group can have a known outcome while still containing an unassessed branch.

## Public teaching studies

Mappings were reviewed on **November 3, 2026**. The public examples are selected historical comparisons, not a live recruitment search. Each retains an unknown requirement for the unmodeled protocol and its qualifications.

| Study | Primary material | Important mapping boundary |
| --- | --- | --- |
| KEYNOTE-189, NCT02578680 | [ClinicalTrials.gov record](https://clinicaltrials.gov/study/NCT02578680) | Stage IV nonsquamous NSCLC, selected prior-treatment and measurable-disease requirements, ECOG 0–1, and the qualified determination that EGFR/ALK-directed therapy is not indicated. Organ function, tissue, timing, exceptions, and other conditions remain unassessed. |
| FLAURA, NCT02296125 | [ClinicalTrials.gov record](https://clinicaltrials.gov/study/NCT02296125), [public protocol](https://cdn.clinicaltrials.gov/large-docs/25/NCT02296125/Prot_000.pdf) | The source names WHO performance status and includes stability over the preceding two weeks. CNS disease has an exception for appropriately treated/stable disease; a blanket brain-metastasis exclusion is not encoded. |
| ADAURA, NCT02511106 | [ClinicalTrials.gov record](https://clinicaltrials.gov/study/NCT02511106), [sponsor record](https://www.astrazenecaclinicaltrials.com/study/D5164C00001/), [public protocol](https://cdn.clinicaltrials.gov/large-docs/06/NCT02511106/Prot_000.pdf) | Protocol edition 5.0, January 8, 2021, uses postoperative pathologic staging under TNM seventh edition, country-specific minimum-age qualifications, central mutation confirmation, complete resection, and treatment/timing branches. The mapped EGFR requirement remains unknown when a qualifying variant is present because central confirmation is still unassessed; permitted variant combinations require source review. Postoperative adjuvant chemotherapy is permitted; “any prior anticancer therapy” is not encoded as a blanket exclusion. |

KEYNOTE-189 and FLAURA registry source snapshots were marked completed, with last-update dates September 20, 2024 and April 21, 2026, respectively. ADAURA's sponsor source reported recruitment complete; that label is not equivalent to study completion. Its current registry update/status was not independently established for this release. A review date records when material was checked, not when the registry was updated.

Selected clauses are paraphrased and linked. The app does not redistribute entire protocols. Current registry records, protocol amendments, and site interpretation must be checked separately before any real-world assessment.

## Registry imports

The local adapter accepts a ClinicalTrials.gov API v2 study object or a `studies` collection. It selects study identity/title, status and date metadata, and eligibility material; contact and investigator modules are not retained. It never fetches a record from an entered URL.

Supported structured age limits in years and sex restrictions may become basic demographic comparisons. Other units, ambiguous or absent limits, and narrative conditions are not guessed. Free-text eligibility is retained for source review and remains a manual requirement. A public registry summary is not necessarily the complete protocol.

This is structured adaptation, not natural-language rule extraction. Uploaded rule packs must express their logic through the supported schema. Imported mappings retain a remainder/manual-review requirement so a small encoded subset cannot appear to certify full eligibility.

## Bounds and validation

| Limit | Value |
| --- | --- |
| UTF-8 JSON input | 2 MiB |
| JSON nesting | 40 levels |
| Parsed nodes | 100,000 |
| Decoded string length | 131,072 UTF-16 code units |
| Studies | 20 |
| Criteria per study | 60, including any required remainder guard |
| Rule nesting | 8 levels |
| Rule nodes per study | 200 |
| Membership options | 20 |
| Numeric parsing | Finite values, at most 15 significant mantissa digits; nonzero underflow rejected |
| Imported eligibility source text | 20,000 characters |

The parser rejects duplicate decoded keys, prototype-sensitive keys, malformed JSON, and numbers outside its supported finite precision. Study and criterion identifiers must be bounded and unique within their scope. Case fields, operators, comparators, and link destinations are restricted. Limits are implementation safeguards; rejecting an input does not mean its source study or clinical data are invalid.

## Reports and interpretation

JSON, CSV, and HTML reports contain outcome summaries, aliases, the chosen assessment date, ruleset version, fixed field names, and explanations. They omit raw case values and imported source prose. They can still reveal information through combinations of criteria and results, so they are not certified anonymous.

A criterion barrier may reflect the entered synthetic facts, the selected mapping, or evidence interpretation. An unknown result may reflect missing evidence, a rule limitation, a timing/unit issue, or a deliberately manual protocol requirement. Neither is a clinical judgment about a person. No automated decision to include, exclude, contact, or enroll a participant is performed.

## Primary methodological references

- [ClinicalTrials.gov protocol data definitions](https://clinicaltrials.gov/policy/protocol-definitions): age limits and eligibility fields.
- [ClinicalTrials.gov API study data structure](https://clinicaltrials.gov/data-api/about-api/study-data-structure): registry field organization.
- [NLM introduction to API v2](https://www.nlm.nih.gov/pubs/techbull/ma24/ma24_clinicaltrials_api.html): structured JSON and rich-text representation.
- [NCI explanation of clinical trials](https://www.cancer.gov/research/participate/clinical-trials/how-trials-work): the role of eligibility requirements.
- [NCI trial-search help](https://www.cancer.gov/research/participate/clinical-trials-search/help): interpretation of criteria and study descriptions.
