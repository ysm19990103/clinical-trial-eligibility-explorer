# Local JSON formats

Use these formats for synthetic teaching cases and public study definitions. Import a JSON file or paste JSON in the app; the CLI accepts the same formats. Processing remains local. Reports omit case facts and imported text, but the editor and source pane display the material you supply.

The parser requires a single JSON object, rejects duplicate decoded keys and prototype-sensitive keys, and enforces the [documented size limits](methodology.md#bounds-and-validation). Unknown fields in the case and study-pack schemas are rejected. Do not add names, record identifiers, contact information, clinical notes, or private protocol material.

## Synthetic case

Required root properties are `schema`, `asOf`, and `facts`. `asOf` is the assessment date, expressed as a valid full calendar date (`YYYY-MM-DD`, years 0001–9999). `facts` contains only supported field keys. Every supplied fact must contain `value`; its only optional properties are `unit` and `observedOn`.

This small case is valid and deliberately incomplete:

```json
{
  "schema": "eligibility-case.v1",
  "asOf": "2026-11-03",
  "facts": {
    "age": { "value": 56, "unit": "years" },
    "disease": { "value": "nsclc" },
    "priorSystemic": { "value": false },
    "egfr": { "value": null },
    "anc": {
      "value": 2.1,
      "unit": "10^9/L",
      "observedOn": "2026-11-01"
    }
  }
}
```

An omitted fact and an explicit `null` value both mean unknown. Boolean `false` and numeric `0` are real values, not missing data. Numeric or boolean strings are rejected rather than coerced. A fact object without a `value` property is invalid.

### Numeric fields and exact units

Case values must be finite and within these software bounds. Integer fields cannot contain fractional values. These bounds limit supported input; they do not define clinically plausible values or trial eligibility.

| Field key | Meaning | Exact unit | Range | Integer only |
| --- | --- | --- | --- | --- |
| `age` | Completed age at screening | `years` | 0–130 | Yes |
| `ecog` | ECOG performance status | `ECOG` | 0–5 | Yes |
| `whops` | WHO performance status | `WHO PS` | 0–5 | Yes |
| `anc` | Absolute neutrophil count | `10^9/L` | 0–100 | No |
| `platelets` | Platelet count | `10^9/L` | 0–3000 | No |
| `hemoglobin` | Hemoglobin | `g/dL` | 0–30 | No |
| `creatinineClearance` | Documented creatinine clearance | `mL/min` | 0–300 | No |
| `daysSinceTherapy` | Supplied interval since prior therapy | `days` | 0–3650 | Yes |

Units are case-sensitive strings. The validator can retain a missing or mismatched case unit so the evaluator can explain the problem; it will produce unknown for a comparison requiring another unit. It does not convert the value. For a usable comparison, include the exact unit above. Do not supply nonempty units for boolean or category facts.

`observedOn`, when supplied, must be a valid full calendar date. If a rule sets `maxAgeDays`, its referenced fact needs an observation date. The limit is inclusive: with an assessment date of November 3 and `maxAgeDays: 7`, October 27 is within the window and October 26 is stale. A future observation date produces unknown even when the rule has no freshness window. An invalid date is rejected at import.

### Category fields

Use the literal values below. An unperformed or uncertain assessment should be omitted or set to `null`, rather than represented by a new category.

| Field key | Accepted values | Interpretation boundary |
| --- | --- | --- |
| `sex` | `female`, `male`, `other` | The protocol's sex field; gender identity is not inferred |
| `disease` | `nsclc`, `other` | A broad teaching category |
| `histology` | `adenocarcinoma`, `nonsquamous`, `squamous`, `other` | `nonsquamous` denotes other nonsquamous NSCLC in the editor |
| `stage` | `stage_iv`, `locally_advanced`, `ib_ii_iiia_tnm7`, `other` | `ib_ii_iiia_tnm7` specifically means postoperative pathologic IB, II, or IIIA under TNM seventh edition |
| `egfr` | `exon19del`, `l858r`, `other`, `not_detected` | The first two mean the variant is present, alone or with other variants; `other` means neither qualifying variant is present. Assay and central confirmation remain separate |
| `alk` | `positive`, `negative` | Untested is unknown, not negative |

### Boolean fields

Each accepts only `true`, `false`, or `null`:

| Field key | Meaning |
| --- | --- |
| `curativeLocalTherapy` | Suitable for curative surgery or radiotherapy |
| `resected` | Complete R0 resection documented |
| `measurable` | Measurable disease documented |
| `egfrAlkTherapyIndicated` | An explicit determination that EGFR- or ALK-directed therapy is indicated |
| `priorSystemic` | Prior systemic therapy for advanced/metastatic disease, not automatically adjuvant or neoadjuvant therapy |
| `priorEgfrTki` | Prior EGFR tyrosine kinase inhibitor |
| `activeCns` | Active symptomatic CNS disease; a sandbox fact, not a complete public-protocol exclusion |
| `activeAutoimmune` | Active autoimmune disease; a sandbox fact without protocol-specific timing qualifications |
| `systemicImmunosuppression` | Systemic immunosuppression |
| `interstitialLungDisease` | Interstitial lung disease history |

The [field catalog](../app/catalog.mjs) contains the executable definitions and editor explanations. A fact can be accepted by the schema without being used by a selected study.

## Structured study pack

The required root properties are `schema` and `studies`. Supply 1–20 studies. Each study needs `id`, `title`, and a nonempty `criteria` array. IDs use 1–64 ASCII letters, digits, periods, underscores, or hyphens and must begin with a letter or digit. Study IDs must be unique within the pack; criterion IDs must be unique within their study.

This pack is a fictional software example. Its laboratory threshold is not taken from a clinical protocol:

```json
{
  "schema": "eligibility-study-pack.v1",
  "studies": [
    {
      "id": "SYNTHETIC-FORMAT-DEMO",
      "title": "Fictional format demonstration",
      "status": "Fictional; no enrollment",
      "criteria": [
        {
          "id": "adult",
          "kind": "inclusion",
          "label": "Fictional minimum age",
          "rule": {
            "op": "compare",
            "field": "age",
            "comparator": "gte",
            "value": 18,
            "unit": "years"
          }
        },
        {
          "id": "recent-lab",
          "kind": "inclusion",
          "label": "Fictional recent ANC requirement",
          "note": "Invented solely to demonstrate a dated numerical comparison.",
          "rule": {
            "op": "compare",
            "field": "anc",
            "comparator": "gte",
            "value": 1.5,
            "unit": "10^9/L",
            "maxAgeDays": 7
          }
        },
        {
          "id": "remaining-protocol",
          "kind": "inclusion",
          "label": "Remaining protocol and investigator review",
          "rule": { "op": "manual" }
        }
      ]
    }
  ]
}
```

### Metadata and criterion properties

Optional study properties are `shortTitle`, `condition`, `phase`, `status`, `sourceDate`, `reviewedOn`, `sourceUrl`, `provenance`, `coverageNote`, and `eligibilityText`. Titles and general text fields are bounded to 500 characters; phase and status to 100; eligibility text to 20,000. Nonempty provenance dates must be valid `YYYY-MM-DD` dates. A source date may identify a registry update or a protocol edition: explain its meaning in a criterion note, and do not imply that it is a current recruitment-status date.

The importer always marks a structured pack as `local-pack` and replaces its coverage note with a fixed selected-subset warning. A supplied `provenance` must be one of `public-curated`, `synthetic`, `registry-import`, or `local-pack`, but cannot confer trusted provenance. No other study properties are accepted.

Each criterion requires `id`, `kind`, `label`, and `rule`. `kind` is exactly `inclusion` or `exclusion`; `label` describes the predicate being tested. Optional `note` and `sourceUrl` retain source context. Label and note limits are 500 characters.

For an exclusion such as “Prior EGFR tyrosine kinase inhibitor,” write a predicate that is true when the exclusion is present. The evaluator applies the inversion at the criterion boundary; do not negate it a second time merely because the criterion is an exclusion.

### Rule operations

| Operation | Required properties | Behavior |
| --- | --- | --- |
| `compare` | `field`, `comparator`, `value` | Compares a supported fact with a typed threshold or category |
| `all` | `children` | Three-state AND over a nonempty list of rule nodes |
| `any` | `children` | Three-state OR over a nonempty list of rule nodes |
| `not` | `child` | Reverses true/false and preserves unknown |
| `manual` | None | Always unknown; optional `reason` is source text, not executable logic |

Every node also includes its `op`. Extra properties and unsupported operations are rejected. There is no script, expression-string, regular-expression, or remote-call operation.

`compare` supports `gte`, `gt`, `lte`, `lt`, `eq`, and `in` for numerical fields. Boolean and category fields support only `eq` and `in`. A scalar comparison uses a single value of the field's type; `in` uses an array of 1–20 correctly typed values. Strings are not converted into numbers, and category tokens must appear in the field catalog.

A comparison may supply `unit` and `maxAgeDays`. For a field with a declared unit, an omitted rule unit is filled from the catalog; a supplied rule unit must match it exactly. `maxAgeDays` must be an integer from 0 through 3650 and requires a dated case fact at evaluation. Omit `unit` for fields without a declared unit.

Here is a fictional composite rule showing all three logical operations. It asks for adult age and either no prior advanced systemic therapy or the absence of a short supplied treatment interval. This is a software example, not a real washout rule:

```json
{
  "op": "all",
  "children": [
    {
      "op": "compare",
      "field": "age",
      "comparator": "gte",
      "value": 18,
      "unit": "years"
    },
    {
      "op": "any",
      "children": [
        {
          "op": "compare",
          "field": "priorSystemic",
          "comparator": "eq",
          "value": false
        },
        {
          "op": "not",
          "child": {
            "op": "compare",
            "field": "daysSinceTherapy",
            "comparator": "lt",
            "value": 28,
            "unit": "days"
          }
        }
      ]
    }
  ]
}
```

Place that node in a criterion's `rule` property. Missing facts remain unknown through the logical operations; see the [truth tables](methodology.md#three-state-reasoning).

### Manual-review guard and limits

Imported packs are selected abstractions. If a study contains no standalone criterion whose root operation is `manual`, the importer adds a “Remaining protocol and investigator review” criterion. A manual node nested inside an OR or AND group does not satisfy this guard, because a branch could otherwise resolve without it. Existing standalone manual criteria remain unknown.

The maximum is 60 criteria and 200 rule nodes per study, including an inserted guard. Leave room for the guard or include a standalone manual criterion yourself. Rule depth is bounded to 8 from a root at depth 0; each `all` or `any` group contains 1–60 children. These limits and the explicit guard prevent a small imported rule set from being presented as complete protocol assessment.

### Source URL allowlist

Optional study and criterion links must use HTTPS and one of these exact hosts:

| Host |
| --- |
| `clinicaltrials.gov` |
| `www.clinicaltrials.gov` |
| `cdn.clinicaltrials.gov` |
| `cancer.gov` |
| `www.cancer.gov` |
| `clinical.nih.gov` |
| `www.clinical.nih.gov` |
| `www.astrazenecaclinicaltrials.com` |
| `www.nlm.nih.gov` |

URLs are limited to 1,000 characters. Credentials, query strings, non-default ports, whitespace, control characters, backslashes, and other hosts are rejected. A blank or omitted URL means no link. Host acceptance does not verify the linked document or its applicability, and no link is fetched during evaluation.

## ClinicalTrials.gov JSON

A registry import uses a ClinicalTrials.gov API v2 study object containing `protocolSection`, or a wrapper with a `studies` array. It is a separate input format; do not rename it to `eligibility-study-pack.v1`.

The adapter requires a correctly shaped `NCT` identifier and an eligibility module, retains selected public metadata, and drops contact modules. Recognized age bounds in whole years and supported sex fields can become simple comparisons. Other units and all clinical eligibility prose remain manual. See [registry-import methodology](methodology.md#registry-imports).

Use a public registry export or the built-in synthetic templates. The app does not fetch records from a URL and never exports the case currently being edited.
