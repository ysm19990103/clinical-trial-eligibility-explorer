# Security and privacy

Use synthetic cases in this public demonstration. The explorer is not a clinical system, an anonymization service, or an eligibility decision service.

## Data boundary

Case facts and imported study material are processed in the current browser tab. The application has no case-upload endpoint, database connection, account, telemetry client, external script dependency, or persistent case store. It does not follow registry URLs automatically. External source links open only when selected by the user.

The case model accepts a fixed set of clinical teaching fields. It has no names, record identifiers, contact details, free-text clinical notes, or date-of-birth field. The case editor necessarily displays the entered values. Public study text may be imported for source review; do not paste patient information or private protocol material into that input.

Report generation uses a reduced model: local aliases, the chosen assessment date, ruleset version, fixed field labels, criterion outcomes, counts, and explanation text. Raw case values, filenames, and imported source text are excluded. A report can still disclose clinical or structural information through its pattern of findings. This is data minimization, not certified de-identification.

## Threat model

| Risk | Implemented control | Remaining limitation |
| --- | --- | --- |
| Accidental case upload | No application network client or data endpoint; Content Security Policy disallows connections | The host receives ordinary page/asset requests. Browser extensions, device software, and a modified deployment are outside this boundary. |
| Sensitive data included in imports | Restricted case schema; registry adapter selects public study fields and excludes contact modules | Arbitrary imported study text may itself contain sensitive information. The app cannot establish that it is public or safe to display. |
| Source text used as code or markup | Explicit rule operations; no expression evaluation; text is rendered with escaping | This is not a general-purpose document sanitizer. Rendering changes must preserve the boundary. |
| Ambiguous or prototype-sensitive JSON | Duplicate decoded keys and reserved object keys are rejected; parser creates null-prototype objects | Some otherwise legitimate JSON is intentionally unsupported. |
| Excessive input workload | Limits on bytes, nesting, strings, studies, criteria, and rule nodes | These are workload bounds, not a measured availability guarantee. |
| Numeric or clinical interpretation errors | Bounded numeric precision, strict types, explicit units, unknown results for unusable evidence | No unit conversion, clinical plausibility assessment, or arbitrary-precision calculation is provided. |
| Case values copied into reports | Exporters project outcomes into a separate report model and omit source facts and imported prose | Outcome patterns can remain sensitive. Review reports before sharing. |
| Data left after a session | No app case persistence; clear/reset controls discard active references | JavaScript cannot guarantee secure memory erasure. Clipboard, browser/OS caches, swap, downloads, and print output remain outside app control. |
| Private material committed to the repository | Authored synthetic cases, public source references, manual review, and automated source/build checks | Pattern scanning has false negatives and does not prove the absence of all sensitive content. |
| Compromised deployment | No third-party npm/runtime dependencies; readable modules; tests and build checks in CI | Node, GitHub Actions, the host, and browser are dependencies. An authorized or compromised publisher can change a static app. |

## Safe development and operation

- Use fictional cases and reserved example values. Do not commit imported cases, report downloads, private protocols, databases, clinical attachments, or credentials.
- Keep fixed public-study source metadata separate from synthetic case facts.
- Review modifications to imports, schemas, source-link handling, rendering, exports, and deployment configuration.
- Run `npm test`, `npm run build`, and `npm run check` before publication.
- Treat a parser rejection or an unknown result as a processing limit or evidence gap; never bypass it by silently coercing missing data to a favorable value.
- The CLI processes locally, but redirected reports and process output may be captured by the caller's environment. Manage those outputs under the appropriate data policy.
- Retain the unassessed-protocol requirement when creating or importing public-trial mappings.

## Reporting a vulnerability

Do not post patient data, secrets, or exploit details in a public issue. If the repository offers **Security → Report a vulnerability**, use that private route. Otherwise, open a minimal public issue requesting a private reporting route without disclosing the vulnerability or sensitive material.

A useful report identifies the affected revision, the boundary that fails, and a minimal synthetic reproduction. No support commitment is implied for independently modified deployments or older copies.
