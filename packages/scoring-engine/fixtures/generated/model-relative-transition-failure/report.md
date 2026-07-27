# Roblox Obby Evaluation Report

## Identity summary

Report payload: sha256:9303b873639e25ecfe0588c43783a9a3d189240e0454c44af9fdcd7b4b1e7de3
Calculation bundle: sha256:f28c675c9bf834ebc0d80c3ea500ea738fe396af6f531a33361a88dc1f9ee3f9
Manifest: sha256:5487d051f578f0791331199904fd7a3a873aaa421f0552179fd7ff6d23b82eb0
Configuration: sha256:a453ae253cd2037cbaeb855a2af3a5ef80e7a4d9e9540ea908b641b4512f6346
Evaluation request: sha256:68197014ffda4d4c85dd35e3d46cd6556240b2c1a670690eee976f37b099bede
Metric catalog: sha256:9b256b76b5bef66b5009f648204a43241ee391ce4a4215390c46cb7c5e877d34
Scoring profile: sha256:fc8adef4a05875dc2169a84bbf84b69ef6987d98b9c47d80c8984e5168a04b2d
Profile: e1-static-default@1.0.0

## Executive state

Outcome: fail-under-profile
Aggregate score: unavailable (E1 does not aggregate categories)

Model-relative infeasibility is not universal impossibility. Candidate findings are not confirmed failures.

## Invariant gates

| Invariant | State | Evidence hashes | Blocked metrics |
| --- | --- | --- | --- |
| checkpoint-ordering | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d | none |
| decorative-gameplay-collision | pass | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 | none |
| evidence-graph-integrity | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |
| finish-topology | pass | sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e | none |
| gameplay-route-authority | pass | sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4, sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d | none |
| required-metric-availability | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |
| required-reference-resolution | pass | sha256:0350eadd7f20a3d45effa6f582986fdc40d08bd5d3aaff9b20c3f73734461964, sha256:133ee003566f27866944027d41931ba9333418b297dae3e77069befd3cb308c9, sha256:3ec0dd0470186f9ff660d45cbdb7d597a057bdc4fe7935f93cf6f955356564ab, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:77be5b9fda588125b65bbc22a1a0ef28321f81b4da04b8e385643b128478dd3a | none |
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
| finish.topology-validity@1.0.0 | calculated | true | sha256:4b82ab2ba41e48a4008cc4ba142411014715a8628f62e1548c3cf9e5a06711a9 | sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e |
| hazard.relationship-candidate-count@1.0.0 | calculated | 1 candidates | sha256:dbcca876c5d3879c489a4ae7f98095c6d86cbea7ac1e3c371b7e95026045549c | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801 |
| performance.native-part-count@1.0.0 | calculated | 6 objects | sha256:4cd77cf2ad27a4dd52d4489026f64e6d00486cb9d1dae471996ae311032d9afd | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| playability.required-transition-feasibility@1.0.0 | calculated | infeasible-under-model | sha256:e624547a4b86485d7a290769c043fc26468e26d63c5b289bbfa42cc58229cc44 | sha256:21eb59507e84ba6ac667c0daa0b7fb577afa6218db8b3a770b50ae3e04e21547, sha256:9d659ac760f4911fdf3cb542e72ea2964947c31a2af7c7736f7a7334bc75da01, sha256:fe54f99acadde93466176b48c95592585c3b1d4e41037a8fe8cb1c2203ea814c, sha256:396b61b581110a29ab1f419829ce6ff1058e6e1ccaff5fae3faf3b75596e08ff, sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801 |
| playability.route-completeness@1.0.0 | calculated | 1 ratio | sha256:4c641915af575022f845c598e849c20ac9e9d80636ca7cc966fa8232da342b89 | sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:3ec0dd0470186f9ff660d45cbdb7d597a057bdc4fe7935f93cf6f955356564ab, sha256:0350eadd7f20a3d45effa6f582986fdc40d08bd5d3aaff9b20c3f73734461964, sha256:77be5b9fda588125b65bbc22a1a0ef28321f81b4da04b8e385643b128478dd3a, sha256:133ee003566f27866944027d41931ba9333418b297dae3e77069befd3cb308c9 |
| playability.skip-candidate-count@1.0.0 | calculated | 0 candidates | sha256:b6887a1d03b1453a461fda03ddb5f39e289139dd94d9c15ed52c35179c157d12 | sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801 |
| policy.decorative-collision-violations@1.0.0 | calculated | 0 objects | sha256:bd4a4ba919c0dad0ad9ada70591394bc2545dfc883dab4ef8a6fc40f190a8659 | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| policy.evidence-completeness@1.0.0 | calculated | true | sha256:301e6e480b562a4c1803ee52fd809870009b45554f64316417c98716360cf0be | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
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
| required-transition-feasibility | playability.required-transition-feasibility | fail | provisional | sha256:21eb59507e84ba6ac667c0daa0b7fb577afa6218db8b3a770b50ae3e04e21547, sha256:9d659ac760f4911fdf3cb542e72ea2964947c31a2af7c7736f7a7334bc75da01, sha256:fe54f99acadde93466176b48c95592585c3b1d4e41037a8fe8cb1c2203ea814c, sha256:396b61b581110a29ab1f419829ce6ff1058e6e1ccaff5fae3faf3b75596e08ff, sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801 |

## Findings

- [info] Checkpoint runtime isolation is missing evidence (finding.checkpoint.runtime-isolation-missing.5)
- [warning] KillFloor bounds candidate (finding.hazard.kill-floor-bounds-candidate.4)
- [warning] Coarse transition exceeds the selected model (finding.playability.coarse-transition-infeasible-under-model.0)
- [warning] Coarse transition exceeds the selected model (finding.playability.coarse-transition-infeasible-under-model.1)
- [warning] Coarse transition exceeds the selected model (finding.playability.coarse-transition-infeasible-under-model.2)
- [warning] Coarse transition exceeds the selected model (finding.playability.coarse-transition-infeasible-under-model.3)

## Evidence index

| Evidence ID | Kind | Subject | Content hash |
| --- | --- | --- | --- |
| e1b:checkpoint:1 | checkpoint-topology | object:Checkpoint01 | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d |
| e1b:coarse-transition:0 | coarse-transition-state | transition:Spawn:JumpPlatform01:0:1 | sha256:9d659ac760f4911fdf3cb542e72ea2964947c31a2af7c7736f7a7334bc75da01 |
| e1b:coarse-transition:1 | coarse-transition-state | transition:JumpPlatform01:Checkpoint01:1:2 | sha256:fe54f99acadde93466176b48c95592585c3b1d4e41037a8fe8cb1c2203ea814c |
| e1b:coarse-transition:2 | coarse-transition-state | transition:Checkpoint01:WedgeClimb01:2:3 | sha256:396b61b581110a29ab1f419829ce6ff1058e6e1ccaff5fae3faf3b75596e08ff |
| e1b:coarse-transition:3 | coarse-transition-state | transition:WedgeClimb01:FinishPlatform:3:4 | sha256:21eb59507e84ba6ac667c0daa0b7fb577afa6218db8b3a770b50ae3e04e21547 |
| e1b:finish | finish-topology | scene | sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e |
| e1b:geometry:scene | geometry-fact | scene | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| e1b:hazard:KillFloor:bounds | hazard-relationship | scene | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836 |
| e1b:hazard:KillFloor:enclosure | hazard-relationship | scene | sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023 |
| e1b:route-graph | route-graph | scene | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| e1b:route-playability-summary | route-playability-summary | scene | sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801 |
| e1b:route-transition:0 | route-transition | transition:Spawn:JumpPlatform01:0:1 | sha256:0350eadd7f20a3d45effa6f582986fdc40d08bd5d3aaff9b20c3f73734461964 |
| e1b:route-transition:1 | route-transition | transition:JumpPlatform01:Checkpoint01:1:2 | sha256:77be5b9fda588125b65bbc22a1a0ef28321f81b4da04b8e385643b128478dd3a |
| e1b:route-transition:2 | route-transition | transition:Checkpoint01:WedgeClimb01:2:3 | sha256:133ee003566f27866944027d41931ba9333418b297dae3e77069befd3cb308c9 |
| e1b:route-transition:3 | route-transition | transition:WedgeClimb01:FinishPlatform:3:4 | sha256:3ec0dd0470186f9ff660d45cbdb7d597a057bdc4fe7935f93cf6f955356564ab |

## Unavailable and deferred capabilities

- runtime.checkpoint-isolation-availability: studio-runtime-deferred; capability=runtime; Metric runtime.checkpoint-isolation-availability is unavailable because studio-runtime-deferred.

## Limitations

- candidate-semantics: Hazard and skip candidates are not confirmed gameplay failures.
- coarse-model-only: Model-relative transition feasibility is not universal Roblox physics proof.
- runtime-deferred: Studio/runtime checkpoint isolation evidence is unavailable in E1c.

## Reproduction information

Calculation bundle identity: sha256:f28c675c9bf834ebc0d80c3ea500ea738fe396af6f531a33361a88dc1f9ee3f9
- checkpoint.topology-validity: method=checkpoint-topology-validity@1.0.0; parameters=sha256:627ad7bbff54fadf25f6cf2c01e7f7bd23f982955709a4d5120ce4e31d92f844; inputs=sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- finish.topology-validity: method=finish-topology-validity@1.0.0; parameters=sha256:725aea11d385785d840a6796ab89bf611ffd9f825aed11c5e467a97a77a7f96b; inputs=sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e
- hazard.relationship-candidate-count: method=hazard-candidate-count@1.0.0; parameters=sha256:cb6ae3258b1c00673b26c8a192093bda5fc192fb2b7fecbbc58c044bee53f0d2; inputs=sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801
- performance.native-part-count: method=native-part-count@1.0.0; parameters=sha256:4d5f76b2eb5cd49eb980eb5cde0215a5b799421dbc10eb0347ba42550a49a8e3; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- playability.required-transition-feasibility: method=required-transition-feasibility@1.0.0; parameters=sha256:a5a55862fa291f9925c183323c00803ffaff239acc7bb77e0928d245b20a8958; inputs=sha256:21eb59507e84ba6ac667c0daa0b7fb577afa6218db8b3a770b50ae3e04e21547, sha256:9d659ac760f4911fdf3cb542e72ea2964947c31a2af7c7736f7a7334bc75da01, sha256:fe54f99acadde93466176b48c95592585c3b1d4e41037a8fe8cb1c2203ea814c, sha256:396b61b581110a29ab1f419829ce6ff1058e6e1ccaff5fae3faf3b75596e08ff, sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801
- playability.route-completeness: method=route-completeness@1.0.0; parameters=sha256:a80bc65a6a5aadf59bc182d5d22b51ee6684aefe7efb89becc33c1a35db7fbb8; inputs=sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:3ec0dd0470186f9ff660d45cbdb7d597a057bdc4fe7935f93cf6f955356564ab, sha256:0350eadd7f20a3d45effa6f582986fdc40d08bd5d3aaff9b20c3f73734461964, sha256:77be5b9fda588125b65bbc22a1a0ef28321f81b4da04b8e385643b128478dd3a, sha256:133ee003566f27866944027d41931ba9333418b297dae3e77069befd3cb308c9
- playability.skip-candidate-count: method=skip-candidate-count@1.0.0; parameters=sha256:c1b09f64b482198d07981cb4506a02151d87ea151356bc6590f99274afff3a4a; inputs=sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801
- policy.decorative-collision-violations: method=decorative-collision-audit@1.0.0; parameters=sha256:ef49e99ea855fc54174ccae89f6d37db11b149192cfa90724df74e6b7f8fdd60; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- policy.evidence-completeness: method=evidence-completeness@1.0.0; parameters=sha256:8c47899599a7f6bf62890d89335c29e1ea95839cab99822aab48e4e69c880fc9; inputs=sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- runtime.checkpoint-isolation-availability: method=runtime-isolation-availability@1.0.0; parameters=sha256:437a68cd4030436d461a60bbbc560c03bff0740fbbd053f9534603d184c514b2; inputs=none
