# Roblox Obby Evaluation Report

## Identity summary

Report payload: sha256:3798a0ecb70767b0532a0e8849c40edf374bfa3309b5912e2b8c3c7a045922e1
Calculation bundle: sha256:c40bd753ea910728bf60f2b4f058a263b2dbd1b8786a44357537815dc2993be3
Manifest: sha256:5487d051f578f0791331199904fd7a3a873aaa421f0552179fd7ff6d23b82eb0
Configuration: sha256:a453ae253cd2037cbaeb855a2af3a5ef80e7a4d9e9540ea908b641b4512f6346
Evaluation request: sha256:68197014ffda4d4c85dd35e3d46cd6556240b2c1a670690eee976f37b099bede
Metric catalog: sha256:9b256b76b5bef66b5009f648204a43241ee391ce4a4215390c46cb7c5e877d34
Scoring profile: sha256:fc8adef4a05875dc2169a84bbf84b69ef6987d98b9c47d80c8984e5168a04b2d
Profile: e1-static-default@1.0.0

## Executive state

Outcome: pass-with-warnings
Aggregate score: unavailable (E1 does not aggregate categories)

Model-relative infeasibility is not universal impossibility. Candidate findings are not confirmed failures.

## Invariant gates

| Invariant | State | Evidence hashes | Blocked metrics |
| --- | --- | --- | --- |
| checkpoint-ordering | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d | none |
| decorative-gameplay-collision | pass | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 | none |
| evidence-graph-integrity | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |
| finish-topology | pass | sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455 | none |
| gameplay-route-authority | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4, sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455 | none |
| required-metric-availability | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |
| required-reference-resolution | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:5d3c6de8117449f913ede959942c0674615a17faa39a3d2adb4fe1fdeb056ab0, sha256:b9e94d17de69aac07027a065375a581157991a3b97df06dcd8e632fe6493dac0, sha256:bae33dae29d4c94a3c086aa39c8d6f645110ec90f975821f6e26fdc8c8d07bb6, sha256:d3f492c4ac609a36f68896e0bb64be18c74fb398c2f82da250cce2d6d53355f4 | none |
| required-route-topology | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |

## Completeness

State: complete
Requested metrics: checkpoint.topology-validity, finish.topology-validity, hazard.relationship-candidate-count, performance.native-part-count, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count, policy.decorative-collision-violations, policy.evidence-completeness, runtime.checkpoint-isolation-availability
Calculated metrics: checkpoint.topology-validity, finish.topology-validity, hazard.relationship-candidate-count, performance.native-part-count, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count, policy.decorative-collision-violations, policy.evidence-completeness, runtime.checkpoint-isolation-availability
Missing metrics: none
Missing evidence kinds: runtime-observation

## Metric calculations

| Metric | State | Value | Calculation hash | Evidence hashes |
| --- | --- | --- | --- | --- |
| checkpoint.topology-validity@1.0.0 | calculated | true | sha256:34fcb2636ad3c026a23ce1c09e37aa96778d1fb4c6caf6e804f89af15a965827 | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| finish.topology-validity@1.0.0 | calculated | true | sha256:f8cb41d8603750c0e5e94b23f95a1245b539edfc6aaaef4cc951cc2f2345a457 | sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455 |
| hazard.relationship-candidate-count@1.0.0 | calculated | 1 candidates | sha256:9e59e6ee9d3d4387853e5c2243f730593271105a0471645b072d098938bfad91 | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450 |
| performance.native-part-count@1.0.0 | calculated | 6 objects | sha256:4cd77cf2ad27a4dd52d4489026f64e6d00486cb9d1dae471996ae311032d9afd | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| playability.required-transition-feasibility@1.0.0 | calculated | feasible-under-model | sha256:8533cb658df702480a4fce7f84e565bda702b42f5baaeed883a9affec3872a1e | sha256:a9415bad8dfdccf669fd19d03a5a66fb3a76dfbff131b377da47d59d13f66298, sha256:09d315603281973f280819f593568fdc0e8afc054570d78320cc8e62823e381c, sha256:e6405122df2f462ea524f7fc3c6f38b3cebeb68a11ec10b06f442a100d9adee6, sha256:7773b8bab81c2af308c33f45d93c926e77d48293314c276c4fb700905ecf4bbc, sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450 |
| playability.route-completeness@1.0.0 | calculated | 1 ratio | sha256:667f3087732f5a2051e0cf945a986d732481fa2d3d6d7050e354842561a8cbbb | sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:5d3c6de8117449f913ede959942c0674615a17faa39a3d2adb4fe1fdeb056ab0, sha256:bae33dae29d4c94a3c086aa39c8d6f645110ec90f975821f6e26fdc8c8d07bb6, sha256:b9e94d17de69aac07027a065375a581157991a3b97df06dcd8e632fe6493dac0, sha256:d3f492c4ac609a36f68896e0bb64be18c74fb398c2f82da250cce2d6d53355f4 |
| playability.skip-candidate-count@1.0.0 | calculated | 1 candidates | sha256:9c4e211f3db9483dbc6ec4f33f4f0f263807840261f4d77955afc695a956458c | sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450, sha256:e6c41586540dcc5c25eff9dd0c39db44d753537305a8a14321ae1deaf79f7699 |
| policy.decorative-collision-violations@1.0.0 | calculated | 0 objects | sha256:bd4a4ba919c0dad0ad9ada70591394bc2545dfc883dab4ef8a6fc40f190a8659 | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| policy.evidence-completeness@1.0.0 | calculated | true | sha256:f742b891dbbd77cb9bbd4efedb353975cb914e87dcac9fc082672a479b3a8c62 | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| runtime.checkpoint-isolation-availability@1.0.0 | unavailable | unavailable | sha256:7e333c7b026abdc2d2efba334c347f290df3f4d6a606ad04379bc169cbd43cba | none |

## Category and profile results

| Category | Status | Metrics | Blocked by |
| --- | --- | --- | --- |
| checkpoint | available | checkpoint.topology-validity, runtime.checkpoint-isolation-availability | none |
| hazard | available | hazard.relationship-candidate-count | none |
| performance | available | performance.native-part-count | none |
| playability | available | finish.topology-validity, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count | none |
| policy | available | policy.decorative-collision-violations, policy.evidence-completeness | none |

### Profile gates

| Gate | Metric | State | Classification | Evidence hashes |
| --- | --- | --- | --- | --- |
| required-transition-feasibility | playability.required-transition-feasibility | pass | provisional | sha256:a9415bad8dfdccf669fd19d03a5a66fb3a76dfbff131b377da47d59d13f66298, sha256:09d315603281973f280819f593568fdc0e8afc054570d78320cc8e62823e381c, sha256:e6405122df2f462ea524f7fc3c6f38b3cebeb68a11ec10b06f442a100d9adee6, sha256:7773b8bab81c2af308c33f45d93c926e77d48293314c276c4fb700905ecf4bbc, sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450 |

## Findings

- [info] Checkpoint runtime isolation is missing evidence (finding.checkpoint.runtime-isolation-missing.2)
- [warning] KillFloor bounds candidate (finding.hazard.kill-floor-bounds-candidate.0)
- [warning] Required-route skip candidate (finding.route.skip-candidate.1)

## Evidence index

| Evidence ID | Kind | Subject | Content hash |
| --- | --- | --- | --- |
| e1b:checkpoint:1 | checkpoint-topology | object:Checkpoint01 | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d |
| e1b:coarse-transition:0 | coarse-transition-state | transition:Spawn:JumpPlatform01:0:1 | sha256:09d315603281973f280819f593568fdc0e8afc054570d78320cc8e62823e381c |
| e1b:coarse-transition:1 | coarse-transition-state | transition:JumpPlatform01:Checkpoint01:1:2 | sha256:e6405122df2f462ea524f7fc3c6f38b3cebeb68a11ec10b06f442a100d9adee6 |
| e1b:coarse-transition:2 | coarse-transition-state | transition:Checkpoint01:WedgeClimb01:2:3 | sha256:7773b8bab81c2af308c33f45d93c926e77d48293314c276c4fb700905ecf4bbc |
| e1b:coarse-transition:3 | coarse-transition-state | transition:WedgeClimb01:FinishPlatform:3:4 | sha256:a9415bad8dfdccf669fd19d03a5a66fb3a76dfbff131b377da47d59d13f66298 |
| e1b:finish | finish-topology | scene | sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455 |
| e1b:geometry:scene | geometry-fact | scene | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| e1b:hazard:KillFloor:bounds | hazard-relationship | scene | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836 |
| e1b:hazard:KillFloor:enclosure | hazard-relationship | scene | sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023 |
| e1b:route-graph | route-graph | scene | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| e1b:route-playability-summary | route-playability-summary | scene | sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450 |
| e1b:route-transition:0 | route-transition | transition:Spawn:JumpPlatform01:0:1 | sha256:bae33dae29d4c94a3c086aa39c8d6f645110ec90f975821f6e26fdc8c8d07bb6 |
| e1b:route-transition:1 | route-transition | transition:JumpPlatform01:Checkpoint01:1:2 | sha256:b9e94d17de69aac07027a065375a581157991a3b97df06dcd8e632fe6493dac0 |
| e1b:route-transition:2 | route-transition | transition:Checkpoint01:WedgeClimb01:2:3 | sha256:d3f492c4ac609a36f68896e0bb64be18c74fb398c2f82da250cce2d6d53355f4 |
| e1b:route-transition:3 | route-transition | transition:WedgeClimb01:FinishPlatform:3:4 | sha256:5d3c6de8117449f913ede959942c0674615a17faa39a3d2adb4fe1fdeb056ab0 |
| e1b:skip:0:2 | skip-candidate | scene | sha256:e6c41586540dcc5c25eff9dd0c39db44d753537305a8a14321ae1deaf79f7699 |

## Unavailable and deferred capabilities

- runtime.checkpoint-isolation-availability: studio-runtime-deferred; capability=runtime; Metric runtime.checkpoint-isolation-availability is unavailable because studio-runtime-deferred.

## Limitations

- candidate-semantics: Hazard and skip candidates are not confirmed gameplay failures.
- coarse-model-only: Model-relative transition feasibility is not universal Roblox physics proof.
- runtime-deferred: Studio/runtime checkpoint isolation evidence is unavailable in E1c.

## Reproduction information

Calculation bundle identity: sha256:c40bd753ea910728bf60f2b4f058a263b2dbd1b8786a44357537815dc2993be3
- checkpoint.topology-validity: method=checkpoint-topology-validity@1.0.0; parameters=sha256:627ad7bbff54fadf25f6cf2c01e7f7bd23f982955709a4d5120ce4e31d92f844; inputs=sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- finish.topology-validity: method=finish-topology-validity@1.0.0; parameters=sha256:725aea11d385785d840a6796ab89bf611ffd9f825aed11c5e467a97a77a7f96b; inputs=sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455
- hazard.relationship-candidate-count: method=hazard-candidate-count@1.0.0; parameters=sha256:cb6ae3258b1c00673b26c8a192093bda5fc192fb2b7fecbbc58c044bee53f0d2; inputs=sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450
- performance.native-part-count: method=native-part-count@1.0.0; parameters=sha256:4d5f76b2eb5cd49eb980eb5cde0215a5b799421dbc10eb0347ba42550a49a8e3; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- playability.required-transition-feasibility: method=required-transition-feasibility@1.0.0; parameters=sha256:a5a55862fa291f9925c183323c00803ffaff239acc7bb77e0928d245b20a8958; inputs=sha256:a9415bad8dfdccf669fd19d03a5a66fb3a76dfbff131b377da47d59d13f66298, sha256:09d315603281973f280819f593568fdc0e8afc054570d78320cc8e62823e381c, sha256:e6405122df2f462ea524f7fc3c6f38b3cebeb68a11ec10b06f442a100d9adee6, sha256:7773b8bab81c2af308c33f45d93c926e77d48293314c276c4fb700905ecf4bbc, sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450
- playability.route-completeness: method=route-completeness@1.0.0; parameters=sha256:a80bc65a6a5aadf59bc182d5d22b51ee6684aefe7efb89becc33c1a35db7fbb8; inputs=sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:5d3c6de8117449f913ede959942c0674615a17faa39a3d2adb4fe1fdeb056ab0, sha256:bae33dae29d4c94a3c086aa39c8d6f645110ec90f975821f6e26fdc8c8d07bb6, sha256:b9e94d17de69aac07027a065375a581157991a3b97df06dcd8e632fe6493dac0, sha256:d3f492c4ac609a36f68896e0bb64be18c74fb398c2f82da250cce2d6d53355f4
- playability.skip-candidate-count: method=skip-candidate-count@1.0.0; parameters=sha256:c1b09f64b482198d07981cb4506a02151d87ea151356bc6590f99274afff3a4a; inputs=sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450, sha256:e6c41586540dcc5c25eff9dd0c39db44d753537305a8a14321ae1deaf79f7699
- policy.decorative-collision-violations: method=decorative-collision-audit@1.0.0; parameters=sha256:ef49e99ea855fc54174ccae89f6d37db11b149192cfa90724df74e6b7f8fdd60; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- policy.evidence-completeness: method=evidence-completeness@1.0.0; parameters=sha256:8c47899599a7f6bf62890d89335c29e1ea95839cab99822aab48e4e69c880fc9; inputs=sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- runtime.checkpoint-isolation-availability: method=runtime-isolation-availability@1.0.0; parameters=sha256:437a68cd4030436d461a60bbbc560c03bff0740fbbd053f9534603d184c514b2; inputs=none
