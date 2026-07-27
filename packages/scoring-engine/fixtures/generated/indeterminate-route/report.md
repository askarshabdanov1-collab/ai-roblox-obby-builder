# Roblox Obby Evaluation Report

## Identity summary

Report payload: sha256:bd47e27555f58a3199331f064bd48e1a35ec7bf6e8b136d51f16012c53a7a26f
Calculation bundle: sha256:47175da345d581ade96e8b5dc07c12cf8a3bf386531a5f8ad571d1ea03cbb4e2
Manifest: sha256:5487d051f578f0791331199904fd7a3a873aaa421f0552179fd7ff6d23b82eb0
Configuration: sha256:a453ae253cd2037cbaeb855a2af3a5ef80e7a4d9e9540ea908b641b4512f6346
Evaluation request: sha256:68197014ffda4d4c85dd35e3d46cd6556240b2c1a670690eee976f37b099bede
Metric catalog: sha256:9b256b76b5bef66b5009f648204a43241ee391ce4a4215390c46cb7c5e877d34
Scoring profile: sha256:fc8adef4a05875dc2169a84bbf84b69ef6987d98b9c47d80c8984e5168a04b2d
Profile: e1-static-default@1.0.0

## Executive state

Outcome: incomplete
Aggregate score: unavailable (E1 does not aggregate categories)

Model-relative infeasibility is not universal impossibility. Candidate findings are not confirmed failures.

## Invariant gates

| Invariant | State | Evidence hashes | Blocked metrics |
| --- | --- | --- | --- |
| checkpoint-ordering | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d | none |
| decorative-gameplay-collision | pass | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 | none |
| evidence-graph-integrity | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |
| finish-topology | pass | sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1 | none |
| gameplay-route-authority | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4, sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1 | none |
| required-metric-availability | missing-evidence | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | policy.evidence-completeness |
| required-reference-resolution | pass | sha256:0f78329bf137c581993a2ad5e94862930289de774415d050a0ebcf8a2472c22a, sha256:3eafbf398b62fa8dbfed566d29d7c98cd114597797f6d2c4ec72e28bf201e74f, sha256:479bff4d832c1b7e00bcc9048dcfe96739b7122e422457c294a41754e55bb1ff, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:948bbcc255fe576a0a231bed2ddb5526148f19bed67a6b3a2284d751b20268d6 | none |
| required-route-topology | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |

## Completeness

State: incomplete
Requested metrics: checkpoint.topology-validity, finish.topology-validity, hazard.relationship-candidate-count, performance.native-part-count, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count, policy.decorative-collision-violations, policy.evidence-completeness, runtime.checkpoint-isolation-availability
Calculated metrics: checkpoint.topology-validity, finish.topology-validity, hazard.relationship-candidate-count, performance.native-part-count, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count, policy.decorative-collision-violations, policy.evidence-completeness, runtime.checkpoint-isolation-availability
Missing metrics: none
Missing evidence kinds: runtime-observation

## Metric calculations

| Metric | State | Value | Calculation hash | Evidence hashes |
| --- | --- | --- | --- | --- |
| checkpoint.topology-validity@1.0.0 | calculated | true | sha256:34fcb2636ad3c026a23ce1c09e37aa96778d1fb4c6caf6e804f89af15a965827 | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| finish.topology-validity@1.0.0 | calculated | true | sha256:4a278b667ba46c2e3f13e57eb6c3f74143584aa347cc8f4d7f4aed9c5516f0b7 | sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1 |
| hazard.relationship-candidate-count@1.0.0 | calculated | 1 candidates | sha256:3ef1e909487b4e08efa06fabd2ab524529c5375f2754f45c6676a1166ca0cdcf | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326 |
| performance.native-part-count@1.0.0 | calculated | 6 objects | sha256:4cd77cf2ad27a4dd52d4489026f64e6d00486cb9d1dae471996ae311032d9afd | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| playability.required-transition-feasibility@1.0.0 | indeterminate | indeterminate | sha256:d3af0fabd9a270df8ca3eeb3b3f73e73506ca70d85f067d8ba5fe4ce0b6a1b7f | sha256:1014ef52c4901d772b644e8034486861627700cfc4c6ba81ac1e5cee6c0bf681, sha256:4529b9f6fa4e96d38a1abce534f0d47ff9ac7203e380d2f4e075d3db82289248, sha256:7fcdb21ee6b74c985a57a0a42743e0a4505318acbe41aa242e361e994632f1e7, sha256:68b3880ebfc5069e85f42d6d373a69f98b84226dc98ce8accf5b7472d99d5904, sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326 |
| playability.route-completeness@1.0.0 | calculated | 1 ratio | sha256:0ccd24ac24013d628db36ea9864523797c6d871063d47a11df1f4a34dc770ac3 | sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:0f78329bf137c581993a2ad5e94862930289de774415d050a0ebcf8a2472c22a, sha256:479bff4d832c1b7e00bcc9048dcfe96739b7122e422457c294a41754e55bb1ff, sha256:948bbcc255fe576a0a231bed2ddb5526148f19bed67a6b3a2284d751b20268d6, sha256:3eafbf398b62fa8dbfed566d29d7c98cd114597797f6d2c4ec72e28bf201e74f |
| playability.skip-candidate-count@1.0.0 | calculated | 0 candidates | sha256:2c43da44d9287b604f2b64ea919e97c2ea7c40358d2fd42d0c3153beca120f77 | sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326 |
| policy.decorative-collision-violations@1.0.0 | calculated | 0 objects | sha256:bd4a4ba919c0dad0ad9ada70591394bc2545dfc883dab4ef8a6fc40f190a8659 | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| policy.evidence-completeness@1.0.0 | calculated | false | sha256:fb70ef47c04366453c2aa3e765636d158231758971d0262664c46a5ad5957c97 | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| runtime.checkpoint-isolation-availability@1.0.0 | unavailable | unavailable | sha256:7e333c7b026abdc2d2efba334c347f290df3f4d6a606ad04379bc169cbd43cba | none |

## Category and profile results

| Category | Status | Metrics | Blocked by |
| --- | --- | --- | --- |
| checkpoint | available | checkpoint.topology-validity, runtime.checkpoint-isolation-availability | none |
| hazard | available | hazard.relationship-candidate-count | none |
| performance | available | performance.native-part-count | none |
| playability | incomplete | finish.topology-validity, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count | none |
| policy | missing-evidence | policy.decorative-collision-violations, policy.evidence-completeness | required-metric-availability |

### Profile gates

| Gate | Metric | State | Classification | Evidence hashes |
| --- | --- | --- | --- | --- |
| required-transition-feasibility | playability.required-transition-feasibility | missing-evidence | provisional | sha256:1014ef52c4901d772b644e8034486861627700cfc4c6ba81ac1e5cee6c0bf681, sha256:4529b9f6fa4e96d38a1abce534f0d47ff9ac7203e380d2f4e075d3db82289248, sha256:7fcdb21ee6b74c985a57a0a42743e0a4505318acbe41aa242e361e994632f1e7, sha256:68b3880ebfc5069e85f42d6d373a69f98b84226dc98ce8accf5b7472d99d5904, sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326 |

## Findings

- [info] Checkpoint runtime isolation is missing evidence (finding.checkpoint.runtime-isolation-missing.3)
- [warning] KillFloor bounds candidate (finding.hazard.kill-floor-bounds-candidate.2)
- [warning] Coarse transition is indeterminate (finding.playability.coarse-transition-indeterminate.0)
- [warning] Coarse transition is indeterminate (finding.playability.coarse-transition-indeterminate.1)

## Evidence index

| Evidence ID | Kind | Subject | Content hash |
| --- | --- | --- | --- |
| e1b:checkpoint:1 | checkpoint-topology | object:Checkpoint01 | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d |
| e1b:coarse-transition:0 | coarse-transition-state | transition:Spawn:JumpPlatform01:0:1 | sha256:4529b9f6fa4e96d38a1abce534f0d47ff9ac7203e380d2f4e075d3db82289248 |
| e1b:coarse-transition:1 | coarse-transition-state | transition:JumpPlatform01:Checkpoint01:1:2 | sha256:7fcdb21ee6b74c985a57a0a42743e0a4505318acbe41aa242e361e994632f1e7 |
| e1b:coarse-transition:2 | coarse-transition-state | transition:Checkpoint01:WedgeClimb01:2:3 | sha256:68b3880ebfc5069e85f42d6d373a69f98b84226dc98ce8accf5b7472d99d5904 |
| e1b:coarse-transition:3 | coarse-transition-state | transition:WedgeClimb01:FinishPlatform:3:4 | sha256:1014ef52c4901d772b644e8034486861627700cfc4c6ba81ac1e5cee6c0bf681 |
| e1b:finish | finish-topology | scene | sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1 |
| e1b:geometry:scene | geometry-fact | scene | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| e1b:hazard:KillFloor:bounds | hazard-relationship | scene | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836 |
| e1b:hazard:KillFloor:enclosure | hazard-relationship | scene | sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023 |
| e1b:route-graph | route-graph | scene | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| e1b:route-playability-summary | route-playability-summary | scene | sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326 |
| e1b:route-transition:0 | route-transition | transition:Spawn:JumpPlatform01:0:1 | sha256:479bff4d832c1b7e00bcc9048dcfe96739b7122e422457c294a41754e55bb1ff |
| e1b:route-transition:1 | route-transition | transition:JumpPlatform01:Checkpoint01:1:2 | sha256:948bbcc255fe576a0a231bed2ddb5526148f19bed67a6b3a2284d751b20268d6 |
| e1b:route-transition:2 | route-transition | transition:Checkpoint01:WedgeClimb01:2:3 | sha256:3eafbf398b62fa8dbfed566d29d7c98cd114597797f6d2c4ec72e28bf201e74f |
| e1b:route-transition:3 | route-transition | transition:WedgeClimb01:FinishPlatform:3:4 | sha256:0f78329bf137c581993a2ad5e94862930289de774415d050a0ebcf8a2472c22a |

## Unavailable and deferred capabilities

- runtime.checkpoint-isolation-availability: studio-runtime-deferred; capability=runtime; Metric runtime.checkpoint-isolation-availability is unavailable because studio-runtime-deferred.

## Limitations

- candidate-semantics: Hazard and skip candidates are not confirmed gameplay failures.
- coarse-model-only: Model-relative transition feasibility is not universal Roblox physics proof.
- runtime-deferred: Studio/runtime checkpoint isolation evidence is unavailable in E1c.

## Reproduction information

Calculation bundle identity: sha256:47175da345d581ade96e8b5dc07c12cf8a3bf386531a5f8ad571d1ea03cbb4e2
- checkpoint.topology-validity: method=checkpoint-topology-validity@1.0.0; parameters=sha256:627ad7bbff54fadf25f6cf2c01e7f7bd23f982955709a4d5120ce4e31d92f844; inputs=sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- finish.topology-validity: method=finish-topology-validity@1.0.0; parameters=sha256:725aea11d385785d840a6796ab89bf611ffd9f825aed11c5e467a97a77a7f96b; inputs=sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1
- hazard.relationship-candidate-count: method=hazard-candidate-count@1.0.0; parameters=sha256:cb6ae3258b1c00673b26c8a192093bda5fc192fb2b7fecbbc58c044bee53f0d2; inputs=sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326
- performance.native-part-count: method=native-part-count@1.0.0; parameters=sha256:4d5f76b2eb5cd49eb980eb5cde0215a5b799421dbc10eb0347ba42550a49a8e3; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- playability.required-transition-feasibility: method=required-transition-feasibility@1.0.0; parameters=sha256:a5a55862fa291f9925c183323c00803ffaff239acc7bb77e0928d245b20a8958; inputs=sha256:1014ef52c4901d772b644e8034486861627700cfc4c6ba81ac1e5cee6c0bf681, sha256:4529b9f6fa4e96d38a1abce534f0d47ff9ac7203e380d2f4e075d3db82289248, sha256:7fcdb21ee6b74c985a57a0a42743e0a4505318acbe41aa242e361e994632f1e7, sha256:68b3880ebfc5069e85f42d6d373a69f98b84226dc98ce8accf5b7472d99d5904, sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326
- playability.route-completeness: method=route-completeness@1.0.0; parameters=sha256:a80bc65a6a5aadf59bc182d5d22b51ee6684aefe7efb89becc33c1a35db7fbb8; inputs=sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:0f78329bf137c581993a2ad5e94862930289de774415d050a0ebcf8a2472c22a, sha256:479bff4d832c1b7e00bcc9048dcfe96739b7122e422457c294a41754e55bb1ff, sha256:948bbcc255fe576a0a231bed2ddb5526148f19bed67a6b3a2284d751b20268d6, sha256:3eafbf398b62fa8dbfed566d29d7c98cd114597797f6d2c4ec72e28bf201e74f
- playability.skip-candidate-count: method=skip-candidate-count@1.0.0; parameters=sha256:c1b09f64b482198d07981cb4506a02151d87ea151356bc6590f99274afff3a4a; inputs=sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326
- policy.decorative-collision-violations: method=decorative-collision-audit@1.0.0; parameters=sha256:ef49e99ea855fc54174ccae89f6d37db11b149192cfa90724df74e6b7f8fdd60; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- policy.evidence-completeness: method=evidence-completeness@1.0.0; parameters=sha256:8c47899599a7f6bf62890d89335c29e1ea95839cab99822aab48e4e69c880fc9; inputs=sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- runtime.checkpoint-isolation-availability: method=runtime-isolation-availability@1.0.0; parameters=sha256:437a68cd4030436d461a60bbbc560c03bff0740fbbd053f9534603d184c514b2; inputs=none
