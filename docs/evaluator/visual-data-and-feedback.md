# Visual evaluation, reference data, human labels, and analytics feedback

## Visual evaluation strategy

Visual evaluation is a future optional capability. E0 selects no production dependency or model.
Every candidate must later pass license, security, privacy, reproducibility, hardware, bias, and
benchmark review and be pinned as an audited external worker.

### Candidate signal roles

| Component                 | Potential role                                                                         | Not suitable as                                                 |
| ------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| OpenCLIP                  | Broad image/text embedding, style/semantic grouping, compatible-reference retrieval    | Objective composition or beauty score                           |
| DINOv2                    | Self-supervised visual features, object/scene consistency, duplicate/outlier detection | Roblox-specific route understanding without calibration         |
| LPIPS                     | Perceptual difference between controlled renders/variants                              | Quality direction; lower difference is not necessarily better   |
| IQA-PyTorch models        | Technical image-quality signals such as blur, artifacts, exposure                      | Gameplay readability or aesthetic quality                       |
| Q-Align                   | Learned image-quality/aesthetic-alignment signal after license/benchmark review        | Ground truth, child-audience preference, or retention predictor |
| ImageReward or equivalent | Pairwise preference prior after strict domain/license evaluation                       | Sole ranking signal or proof of user preference                 |
| Segmentation              | Separate route, hazard, goal, character, UI, sky, and decoration regions               | Reliable unattended truth without labeled Roblox validation     |
| Saliency analysis         | Estimate focal regions and saliency dispersion                                         | Human attention proof                                           |
| Palette extraction        | Dominant colors, role separation, palette drift, contrast inputs                       | Style quality by itself                                         |
| Custom Roblox heuristics  | Projected obstacle size, route continuity, hazard/goal contrast, screen clutter        | Universal visual standards                                      |

Model names are examples to evaluate later, not committed dependencies.

### Weak-signal fusion

The future system combines weak signals only after protocol and domain calibration:

1. Validate screenshot protocol and identify regions from geometry projection where possible.
2. Extract deterministic image facts: dimensions, histograms, palette, edge/object densities.
3. Run segmentation/saliency with model/version/confidence retained.
4. Calculate Roblox-specific heuristics using route/hazard/goal regions.
5. Compare within-scene consistency across views.
6. Optionally compare against compatible curated ReferenceProfiles.
7. Keep human pairwise aggregates separate.
8. Fuse calibrated signals into metric estimates with an explicit model (for example, constrained
   regression or monotonic ensemble) whose inputs and ablations are reported.
9. Penalize confidence for model disagreement, out-of-domain inputs, missing views, and protocol
   deviations.
10. Never allow visual fusion to remove deterministic blocking findings.

Reports expose component signals and disagreement. A fused score is not accepted unless it
outperforms simple baselines on held-out Roblox-specific validation and remains stable across
device/view/style strata.

### Visual evaluation limitations

- Beauty and appeal are subjective, audience-specific, cultural, and context-dependent.
- Fixed screenshots omit motion, controls, audio, social context, UI flow, and longer-session
  learning.
- Embeddings inherit training-data bias and may overreward familiar/popular styles.
- Technical image quality can conflict with intentional stylization.
- Segmentation and saliency can fail on unusual materials, lighting, or low-contrast scenes.
- Reference proximity can punish novelty and must remain informational.
- No visual model result implies legal permission to reproduce reference content.

## Curated public reference dataset design

### Purpose

The dataset supports protocol validation, contextual feature distributions, duplicate detection,
and future held-out benchmarking. It is not a source of competitor maps/assets and is not evidence
that popular experiences are visually superior.

### Reference metadata

Each ReferenceProfile records:

- source URL and public experience/page identifier where permitted;
- capture date/time, collector, acquisition method, and screenshot protocol/type;
- license, terms, permission, or fair-use review status and allowed uses;
- provenance chain for each image and derived feature;
- genre/subgenre, Obby mechanics tags, intended audience tags where publicly declared;
- visual style, palette, camera/view, device/viewport, UI/character visibility, and capture quality;
- public popularity indicators with source and observation date;
- annotation protocol/version, annotator count, agreement, and quality tier;
- exclusion/withdrawal status, duplicate group, and dataset split.

Public visits, favorites, likes, concurrency, or ranking are stored only as time-stamped contextual
indicators. They are confounded by marketing, age, social graphs, monetization, platform placement,
updates, and many other factors and are never direct quality labels.

### Acquisition and provenance

- Use only public material whose collection and intended internal use pass legal/terms review.
- Prefer creator-provided press/media assets, explicitly permitted captures, or our own documented
  captures of publicly accessible experiences when allowed.
- Do not bypass authentication, rate limits, technical protections, or access controls.
- Do not collect private analytics, unpublished assets, source place files, maps, scripts, account
  data, or player communications.
- Record transformations (resize, crop, colorspace) as a derivation chain; retain the unmodified
  permitted source when policy allows.
- Automated scraping is explicitly outside E0 and requires a separate approved design/phase.

### Exclusion criteria

Exclude or quarantine:

- unknown or incompatible rights/terms status;
- private, leaked, paywalled, access-controlled, or user-personal material;
- screenshots containing identifiable chat/usernames unless irreversibly redacted under policy;
- non-Obby experiences mislabeled as references;
- promotional composites that cannot be distinguished from gameplay when the task needs gameplay;
- corrupted, heavily recompressed, watermarked, or protocol-unknown images for quality benchmarks;
- copied/infringing assets or experiences where provenance concerns are identified;
- unsafe or age-inappropriate content for the intended study;
- near-duplicates beyond the selected deduplication representative.

### Duplicate and leakage control

- Exact byte and normalized-image hashes catch identical/re-encoded files.
- Perceptual hashes and future DINO/OpenCLIP features propose near-duplicate groups.
- Human review confirms ambiguous duplicate clusters.
- All images from one experience/update/capture session and all duplicate groups remain in one
  split.
- Creator/franchise/style leakage is measured and, where needed, grouped across splits.
- Training, validation, and test snapshots are immutable and content-addressed; test labels remain
  access-restricted.

### Splits

- **Training:** only for future approved calibration/training, never E0.
- **Validation:** threshold and model-selection work.
- **Test:** locked final comparison, stratified by genre/style/view/device and isolated by
  experience/duplicate group.
- **Audit/challenge:** novel styles, low-light/mobile, unusual geometry, and model-failure cases.

Reference comparison can operate on an approved non-training snapshot before any learned model is
trained.

### Deletion and withdrawal

1. Mark source `restricted` immediately on a credible request or policy issue.
2. Stop new evaluation use and feature generation.
3. Locate artifacts/derived features through provenance indexes.
4. Delete according to rights/retention policy; create a non-reversible tombstone with reason/date.
5. Invalidate affected dataset snapshots and publish a successor snapshot.
6. Identify reports/models depending on the source; historical reports retain a limitation marker.
7. Retrain/recalibrate future models when impact thresholds require it.

## Human pairwise labeling protocol

### Question families

For two protocol-matched variants, ask one focused question at a time:

- Which route is clearer?
- Which composition is more coherent?
- Which scene looks less cluttered?
- Which first frame is more appealing?
- Which scene better communicates the objective?
- Which mobile view is easier to read?

Do not ask “Which game is better?” when the evidence only supports a visual comparison.

### Rater instructions

- Judge only the named dimension and shown view(s).
- Ignore personal familiarity, brand/character preference, popularity, monetization, and creator.
- Do not infer gameplay not visible in the evidence.
- Select `tie` when materially equivalent.
- Select `uncertain` when evidence is insufficient or the distinction is unclear.
- Select `skip` for broken, unsafe, or mismatched content.
- Keep comments factual and do not include personal information.

Left/right order, scene identifiers, and nonessential branding are randomized/blinded where
possible. The same rater does not see repeated near-identical pairs close together.

### Quality control

- gold questions with clear protocol defects, not subjective “correct beauty” answers;
- duplicate/reversed pairs to measure self-consistency;
- minimum/maximum response-time flags, never used alone to reject a rater;
- instruction comprehension checks;
- balanced pair order and source distribution;
- exclusion rules fixed before analysis;
- reason-code consistency and comment moderation;
- audit samples reviewed by trained adjudicators.

### Agreement and aggregation

- Report raw counts for left/right/tie/uncertain/skip.
- Use pairwise models such as Bradley–Terry only after checking fit and transitivity assumptions.
- Report bootstrap uncertainty or credible intervals, effective sample size, and rater clustering.
- Measure agreement with statistics appropriate for pairwise/tie labels and report per-question
  family/cohort.
- Low agreement is a result, not a reason to manufacture a decisive label.
- Keep aggregate subjective preference separate from deterministic/heuristic metrics.

### Bias handling

- Track approved aggregate device familiarity, accessibility needs, geography/language, and
  experience level only when consented and necessary.
- Test order, style familiarity, device, brightness, language, and cohort effects.
- Audit model/rater disagreement and systematic underperformance on novel styles.
- Avoid demographic inference from images or behavior.
- Publish known sampling limitations with every aggregate.

### Child-safety and privacy

- Default to trained adult raters for initial studies.
- Involving minors requires separate legal/ethics review, verifiable guardian consent where
  required, age-appropriate instructions, data minimization, and safeguarding procedures.
- Do not collect voice, face, chat, Roblox usernames/user IDs, or free-form personal details.
- Use pre-screened content, moderated comments, pseudonymous study IDs, least-privilege access, and
  bounded retention.

### Storage

Use the `HumanPreferenceLabel` contract with task/instructions versions, randomized order, choice,
reason codes, pseudonymous rater ID, consent/retention class, quality-control outcome, and immutable
artifact hashes. Rater identity mapping, if ever required, stays in a separate restricted system.

## First-party retention feedback loop

### Allowed future signals

Only from Roblox experiences owned/operated by this project and after privacy/platform review:

- first-session completion;
- per-stage funnel entry/completion;
- death locations and causes;
- exits and checkpoint abandonment;
- session duration;
- device class;
- frame-time/performance aggregates;
- D1/D7 retention where legitimately available;
- experiment assignment and eligibility.

### Event-to-calibration flow

1. Version scene, evaluator report, experiment, event schema, and release.
2. Minimize raw events and pseudonymize/session-scope identifiers.
3. Validate event integrity and exclude bots/test sessions/invalid versions by predefined rules.
4. Aggregate into privacy-safe cohorts with minimum counts.
5. Join only through approved scene/version/experiment dimensions.
6. Compare evaluator predictions with outcomes by device, stage, and experiment.
7. Calibrate thresholds/weights on a development snapshot.
8. Validate on later held-out experiences/time periods.
9. Publish calibration version, sample coverage, uncertainty, and limitations.
10. Keep the previous calibration reproducible and support rollback.

### Correlation, causation, and experiments

- Observational association is labeled correlation.
- A high evaluator score does not guarantee retention.
- D1/D7 is influenced by acquisition, audience, content cadence, social context, monetization, bugs,
  and external events.
- Causal claims require pre-registered randomized experiments, valid assignment/exposure, sufficient
  power, guardrail metrics, and analysis of attrition/interference.
- Even experiments estimate effects for tested populations/variants, not universal laws.
- Retention readiness remains a multi-component advisory profile.

### Experiment safety

- Assignment is stable and logged with version/eligibility.
- Do not expose players to known blocking playability or safety defects.
- Define rollback/stop conditions for crashes, frame risk, extreme exits/deaths, or data integrity.
- Do not optimize engagement at the expense of child safety, deceptive design, accessibility, or
  platform rules.
- Evaluator calibration cannot automatically publish or mutate a live experience.

### Privacy and governance

- No private competitor analytics.
- Collect no data before a separately reviewed analytics phase.
- Document purpose, lawful basis/consent where applicable, retention, access, deletion, and regional
  requirements.
- Prefer aggregates and coarse locations/device classes; avoid raw movement trails unless proven
  necessary and approved.
- Enforce minimum cohort size and suppress sparse intersections.
- Maintain a data dictionary and lineage from release to calibration snapshot.
