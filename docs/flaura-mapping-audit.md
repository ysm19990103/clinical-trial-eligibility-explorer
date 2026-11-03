# FLAURA measurable-disease mapping audit

Reviewed **2026-11-03** against repository baseline `3f8478ddb3e063922d86c5c7aae57139b614e703`. This audit concerns the historical FLAURA study, **NCT02296125 / D5160C00007**, not FLAURA2, current prescribing eligibility, or recruitment. All software verification uses fictional cases.

## Decision and source reconciliation

Add an explicit measurable-disease prerequisite using the existing `measurable` boolean and evaluator. Keep a separate, always-unassessed imaging-qualification row and the existing `remaining-protocol` safeguard. The prior omission was a coverage gap in a selected-criteria tool, not evidence that it previously certified full eligibility.

| Source inspected | Version / locator | Finding and interpretation |
| --- | --- | --- |
| [Published FLAURA protocol][protocol] | Edition 4.0, 2018-03-07; section 3.1(9), printed p. 38 (PDF page 39); Appendix C2, p. 131; section 5.1.4, p. 71 | Requires baseline measurable disease and details lesion selection. The single-lesion biopsy exception is explicit. This is the source for the new criterion links. |
| [ClinicalTrials.gov record][registry] and [API v2 record][api] | Last update posted 2026-04-21; verified 2026-04; `eligibilityModule` and `largeDocumentModule` | The eight-item inclusion summary omits measurable disease. The document module links the above protocol, dated 2018-03-07 and uploaded 2018-06-13. Summary omission does not establish removal from the protocol. |
| [EU Clinical Trials Register][eu] | EudraCT 2014-002694-11, GB entry, E.3 item 9; inspected 2026-11-03 | Includes a measurable-lesion clause but does not include the sole-lesion biopsy exception in that summary. Do not turn this shorter wording into an unconditional biopsy exclusion. |
| [Official TAGRISSO prescribing information][label] | Section 14.3, **FLAURA – TAGRISSO Monotherapy**; DailyMed archive lists current SPL version 37, published 2026-09-25; inspected 2026-11-03 | Independently identifies RECIST v1.1 measurability as an entry requirement. Section 14.4 describes FLAURA2 and is not used for this rule. A prescribing-information summary does not replace the protocol. |

The protocol cover and running headers date edition 4.0 to **7 March 2018**; its version-history heading says **2 March 2018**. Use the cover/document-module date. That history states eligibility was unchanged by this amendment, supporting its use for this historical mapping. Site-specific amendments were not exhaustively audited. The registry update date, protocol date, and DailyMed publication date are different kinds of metadata.

### Qualifications requiring review

The protocol requires a nonirradiated, repeatedly measurable CT/MRI lesion: at least 10 mm in longest diameter, or 15 mm on the short axis for nodes. Screening-biopsy targets are normally excluded; a sole measurable lesion is permitted if nonirradiated and baseline imaging follows biopsy by at least 14 days. Section 5.1.4 repeats this exception. See [section 3.1(9)][protocol] and [Appendix C2][appendix].

These conditions cannot be established by the current boolean. No lesion dimensions, modality, radiation history, biopsy dates, or prose are interpreted automatically. The 14-day biopsy-to-scan interval is **not** a maximum evidence age measured from the case review date; no `maxAgeDays: 14` rule is introduced.

## Implemented behavior

The FLAURA template gains two rows:

- `measurable`: an inclusion comparison, `measurable == true`, labeled as a **selected check**.
- `measurable-qualifications`: manual review of the full imaging requirement, linked to the same protocol passage.

| Synthetic evidence | Selected measurable check | Imaging qualifications | Overall FLAURA result when other automated checks are favorable |
| --- | --- | --- | --- |
| `true`: measurable disease documented | `meets` | `unknown` | `unknown` |
| `false`: absence documented | `does_not_meet` | `unknown` | `does_not_meet` for the selected subset |
| `null`: explicitly unassessed | `unknown` | `unknown` | `unknown` |
| Field omitted: no evidence supplied | `unknown` | `unknown` | `unknown` |

Missing assessment is not documented absence. The field help now makes that distinction explicit. Existing typed-input validation rejects strings such as `"false"`; direct evaluator calls also retain uncertainty for invalid facts. Future-dated evidence remains unknown. Supplying a measurement observation date or a therapy interval never satisfies the manual imaging row.

`remaining-protocol`, performance-stability review, and CNS exception review remain present and unknown, even for favorable synthetic facts. The evaluator, parser, registry adapter, case schema, and report implementation are unchanged. No new automatic interpretation of registry prose is introduced.

The ruleset changes from `eligibility-selected-2026-11-03` to `eligibility-selected-2026-11-03-r2` so JSON/HTML reviews distinguish the mapping revision and changed criterion positions. Application version remains 1.0.1; this PR does not create a release. Existing CSV reports have no ruleset metadata; they retain aliases and the selected-subset notice, so keep the accompanying JSON/HTML when revision attribution is needed.

## Related-criteria review

This is a coverage inventory, not a claim that the remaining protocol has been encoded. Existing criteria below remain unchanged.

| Area | Current mapping and remaining boundary | Disposition |
| --- | --- | --- |
| FLAURA age | Registry bounds are 18–100. Protocol section 3.1(2) uses 18 generally and 20 for Japan, without that upper bound. | Retain the explicitly labeled **registry** range. Country-specific protocol eligibility remains unassessed; a registry-range result must not be read as a protocol-age determination. Future refinement needs a stated jurisdiction policy. |
| FLAURA population | Disease, adenocarcinoma, advanced stage, and lack of curative local treatment are modeled. Predominantly adenocarcinomatous mixed histology is permitted by protocol section 3.1(3). | Pathology categorization requires human judgment; do not infer it from free text or reject mixed disease merely because it is mixed. |
| FLAURA EGFR and tissue | Qualifying variants are modeled; assay acceptability and mandatory tumor material are not established by the variant field. [Registry][registry], [label section 14.3][label]. | Keep the existing qualified variant check and remainder review; do not import ADAURA's central-confirmation rule into FLAURA. |
| FLAURA treatment | Advanced-disease systemic therapy and prior EGFR-TKI are modeled. Prior perioperative treatment is not a blanket exclusion. [EU E.3/E.4][eu]. | Preserve treatment-setting distinctions; treatment eligibility, recovery, and procedure/drug windows remain manual. |
| FLAURA performance and prognosis | WHO 0–1 is modeled; two-week stability is manual. The registry also specifies at least 12 weeks' life expectancy. [Registry][registry]. | Prognosis is a comparable omitted prerequisite retained under `remaining-protocol`; a WHO score cannot supply it. ECOG is not substituted for WHO. |
| FLAURA CNS, ILD, and other exclusions | CNS exceptions remain manual. ILD history alone cannot represent all pulmonary exclusions; cardiac, infection, drug-interaction, organ-function, reproductive, and other requirements also remain unmodeled. [EU E.4][eu], protocol section 3.2. | Do not equate a negative generic boolean or fictional sandbox lab result with clearance of these provisions. |
| KEYNOTE-189 | The [registry][keynote] already supplies the measurable-disease requirement used by this template. Tissue, at least three months' life expectancy, organ function, and detailed exceptions remain unassessed. | No comparable missing measurable row; preserve its three-state behavior. A FLAURA-specific biopsy exception is not copied into KEYNOTE-189. |
| ADAURA | [Label section 14.1][label] and [protocol edition 5.0][adaura] describe an adjuvant setting after complete resection. Its tissue confirmation, staging, surgery, and timing are distinct. | Do not add a metastatic measurable-disease prerequisite. R0 documentation alone does not establish every surgical, recovery, imaging, or exclusion condition. |

The KEYNOTE-189 registry update remains 2024-09-20. The ADAURA API record inspected for this comparison was updated 2026-09-11 and reports `ACTIVE_NOT_RECRUITING`; that new observation does not change the older sponsor-snapshot label used by its existing template. These are historical teaching examples, not a live status feed.

## Verification

The inspected baseline actually contains **88** passing tests, rather than the earlier 79-test development record. The 13 added tests in [flaura.test.mjs](../tests/flaura.test.mjs) first produced 11 failures against the old mapping (the two unrelated-template protections passed). All 13 pass after the correction.

Coverage includes the four evidence states above; invalid typed values; future dates; no accidental biopsy/freshness inference; continued manual review; strict study-pack import with source links; JSON/CSV/HTML output; CLI exit codes and validated imports; and protections for KEYNOTE-189 and ADAURA. No real cases, private registry records, identifying information, credentials, or external AI services are used.

| Verification on the proposed change | Result |
| --- | --- |
| `node --test tests/flaura.test.mjs` | 13/13 passed. |
| `npm test` | 101/101 passed, no skips or failures; local Node.js v24.22.1. The existing PR workflow runs Node.js 22. |
| `npm run build` | Passed; nine content-addressed modules and static assets produced. |
| `npm run check` | Passed across 50 source/build files; syntax and existing credential/data/transport/persistence heuristics. This is not proof of comprehensive de-identification. |
| `git diff --check` | Passed. |
| Baseline object comparison | Every pre-existing FLAURA criterion and every other study definition is unchanged; only the two FLAURA rows and its coverage note are added/updated. |
| Browser smoke attempt | Not completed. The local Playwright Chromium executable was absent; its download failed with an invalid/truncated archive. No new browser-interaction result is claimed. |

The pull request's Checks tab and description provide the hosted CI run and exact tested commit. Opening this PR does not merge or deploy the change; approval is required before merging.

### Reproducible source identity

The public protocol was read as text and its measurement clause visually checked in the PDF. Its downloaded bytes have SHA-256 `135417c917e5bf07f13507e3f389ea129d3d5d716d5254af31c6b682798a4cc1`. The FLAURA API response inspected on 2026-11-03 has SHA-256 `963d25d864ef8bfc86ceec93692c5908014c295406c88b8f6c3cba528aff1399`. These fingerprints identify inspected bytes, not permanent guarantees that live URLs will remain unchanged. The full documents/registry responses are not redistributed in this repository.

[protocol]: https://cdn.clinicaltrials.gov/large-docs/25/NCT02296125/Prot_000.pdf#page=39
[appendix]: https://cdn.clinicaltrials.gov/large-docs/25/NCT02296125/Prot_000.pdf#page=132
[registry]: https://clinicaltrials.gov/study/NCT02296125
[api]: https://clinicaltrials.gov/api/v2/studies/NCT02296125
[eu]: https://www.clinicaltrialsregister.eu/ctr-search/trial/2014-002694-11/GB
[label]: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5e81b4a7-b971-45e1-9c31-29cea8c87ce7
[keynote]: https://clinicaltrials.gov/study/NCT02578680
[adaura]: https://cdn.clinicaltrials.gov/large-docs/06/NCT02511106/Prot_000.pdf
