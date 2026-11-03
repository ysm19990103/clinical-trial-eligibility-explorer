# Architecture

The explorer is a static JavaScript application with no runtime package dependencies. Its browser interface and Node CLI share the same input validation, rule evaluation, and reporting modules.

## Processing path

1. A built-in synthetic scenario or bounded local JSON input supplies a case, a study pack, or a registry export.
2. Schema validation limits the case to known fields and the study rules to explicit operations. The registry adapter retains a small public-study projection.
3. The evaluator computes true, false, or unknown for each rule node, then applies inclusion/exclusion polarity at the criterion boundary.
4. The interface displays outcomes, missing evidence, source context, and the reasoning tree.
5. Exporters construct reports from outcomes and safe structural metadata. They do not export the active case or imported source text.

No processing step calls a remote model, terminology service, registry API, or clinical system.

## Module responsibilities

| Module | Responsibility |
| --- | --- |
| `app/catalog.mjs` | Field definitions, value domains, fixed source links, version, and input limits |
| `app/examples.mjs` | Fresh synthetic case fixtures for documented, incomplete, conflicting, and stale-evidence scenarios |
| `app/trials.mjs` | Selected public-study mappings and the fictional laboratory protocol |
| `app/parser.mjs` | Bounded JSON parsing and strict case/study-pack validation |
| `app/registry.mjs` | Conservative projection of ClinicalTrials.gov API v2 JSON into the local study model |
| `app/engine.mjs` | Three-state predicate evaluation, evidence checks, criterion polarity, and study summaries |
| `app/exports.mjs` | Reduced JSON, CSV, and standalone HTML reports |
| `app/ui.mjs` | Browser session state, form interactions, source review, comparisons, and downloads |
| `scripts/audit.mjs` | Local command-line input, review, report output, and exit codes |
| `scripts/build.mjs` | Static build with content-addressed modules and styles |
| `scripts/check.mjs` | JavaScript syntax and selected accidental-secret/data/transport checks |

## Data models

A case uses the `eligibility-case.v1` schema, a full calendar assessment date, and a dictionary of known facts. Each fact carries a typed value and, where applicable, a unit and observation date. A missing or null value remains unknown. The model has no patient identity or narrative fields.

A study pack uses `eligibility-study-pack.v1`. A study contains metadata, provenance, coverage notes, and criteria. Each criterion has an inclusion/exclusion kind, a source-linked description, and a rule tree. The tree contains only `compare`, `all`, `any`, `not`, or `manual` operations. There is no dynamic expression language or executable code in an imported pack.

Evaluation preserves the distinction between predicate truth and criterion outcome. For example, a true exclusion predicate becomes a criterion barrier. Every criterion remains in the result even when another criterion already conflicts. The engine does not mutate the case or study definitions.

## State and privacy

The active case and study library remain in memory for the session. A successful import replaces the relevant active model; rejected input leaves the previous review available. Clear session discards the active case and imported definitions, then restores the built-in study library; this is not secure memory erasure. There is no saved history or background synchronization.

Raw synthetic facts are visible in the editor, and imported public-study text is visible in the source pane. Exporters have a stricter boundary than the interface: they omit raw facts, imported prose, and filenames while retaining the chosen assessment date and ruleset version. Local study and criterion aliases identify positions in one review, not durable patient or registry identities.

## Deployment and verification

The build emits static HTML, JavaScript, CSS, and an icon into `dist/`. No server or secret is needed. Content Security Policy restricts scripts and styles to the same origin, disallows connections, and disables executable object and worker content.

The Node test suite covers the domain logic and adapters independently from browser interaction checks. CI runs tests, builds the static assets, scans source and output, and publishes only the built directory through GitHub Pages. Coverage percentages describe the exercised modules; they do not establish clinical validity, privacy compliance, or completeness of the protocol mappings.
