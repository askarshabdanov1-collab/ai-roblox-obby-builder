# Roblox Obby Evaluation Report

## Identity summary

Report payload: sha256:65b23eec3213c461e4bd4a32b8f6ae30bec62a9bf05a7863f3492396268cac77
Calculation bundle: sha256:4c3a74ff52a2b84091a92299d71192e83a62562849f1c8123c103ffd9b409cb0
Manifest: sha256:5487d051f578f0791331199904fd7a3a873aaa421f0552179fd7ff6d23b82eb0
Configuration: sha256:a453ae253cd2037cbaeb855a2af3a5ef80e7a4d9e9540ea908b641b4512f6346
Evaluation request: sha256:68197014ffda4d4c85dd35e3d46cd6556240b2c1a670690eee976f37b099bede
Metric catalog: sha256:9b256b76b5bef66b5009f648204a43241ee391ce4a4215390c46cb7c5e877d34
Scoring profile: sha256:fc8adef4a05875dc2169a84bbf84b69ef6987d98b9c47d80c8984e5168a04b2d
Profile: e1-static-default@1.0.0

## Executive state

Outcome: fail
Aggregate score: unavailable (E1 does not aggregate categories)

Model-relative infeasibility is not universal impossibility. Candidate findings are not confirmed failures.

## Invariant gates

| Invariant | State | Evidence hashes | Blocked metrics |
| --- | --- | --- | --- |
| checkpoint-ordering | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d | none |
| decorative-gameplay-collision | pass | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 | none |
| evidence-graph-integrity | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |
| finish-topology | fail | sha256:e641fc0da01cab3a6aeca640254d6dde4ced839b7de39c7b936909114bb580d6 | finish.topology-validity |
| gameplay-route-authority | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4, sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:e641fc0da01cab3a6aeca640254d6dde4ced839b7de39c7b936909114bb580d6 | none |
| required-metric-availability | missing-evidence | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | policy.evidence-completeness |
| required-reference-resolution | pass | sha256:20ac2f73dcd6df9fb034d0363d3a27c06b7ad5cabc1dbbff90c151438773a262, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:6abf9e53f8062a3655ed0d8b01ad563db189ee5d8d52697122e7f279d55d5455, sha256:e80a2298bdeb760bab417a3b60d8214f8a01599df02405af75e538052c23a5b0, sha256:f8b56ab83d81660725b7343cfb2c6c9ee6026e600f767f5226e4b7cd5fd1a0eb | none |
| required-route-topology | pass | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |

## Completeness

State: blocked
Requested metrics: checkpoint.topology-validity, finish.topology-validity, hazard.relationship-candidate-count, performance.native-part-count, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count, policy.decorative-collision-violations, policy.evidence-completeness, runtime.checkpoint-isolation-availability
Calculated metrics: checkpoint.topology-validity, finish.topology-validity, hazard.relationship-candidate-count, performance.native-part-count, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count, policy.decorative-collision-violations, policy.evidence-completeness, runtime.checkpoint-isolation-availability
Missing metrics: none
Missing evidence kinds: runtime-observation

## Metric calculations

| Metric | State | Value | Calculation hash | Evidence hashes |
| --- | --- | --- | --- | --- |
| checkpoint.topology-validity@1.0.0 | calculated | true | sha256:34fcb2636ad3c026a23ce1c09e37aa96778d1fb4c6caf6e804f89af15a965827 | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| finish.topology-validity@1.0.0 | calculated | false | sha256:a7633a68cc5246d50a61d00ea94d0259a57c7ce0b1a0270362f31daf95bc53c7 | sha256:e641fc0da01cab3a6aeca640254d6dde4ced839b7de39c7b936909114bb580d6 |
| hazard.relationship-candidate-count@1.0.0 | calculated | 1 candidates | sha256:27bf58c00d65c02080c0d34c62bd77dafc3b1b2409bad12c9620ef6e5049b8ce | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:ef476e8be3898d1436fefdf85ec1eb4e76fae5e12652b8fd5547f5b554c333b4 |
| performance.native-part-count@1.0.0 | calculated | 6 objects | sha256:4cd77cf2ad27a4dd52d4489026f64e6d00486cb9d1dae471996ae311032d9afd | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| playability.required-transition-feasibility@1.0.0 | calculated | feasible-under-model | sha256:cfa806bf5f90d1dc1d7696612611036a639fa5c26980f2bbe71c3170d9252f2b | sha256:e44b81645bedb750c6377eaa6e51e3dfbbc6a41fa473e7c149df0ef18db046c7, sha256:3cfa63691a4771e01e2037c8569a584f6812f74060e54422f7067567473bcddc, sha256:5fa821bb79023bb2a7053f82a4359074c4df491503c30f2c2cd66d8a13a9dad9, sha256:6fffd3e4743ea9bbe407bf7ac5b7896eb8bdb2e2cbd1cefdd238e8206e87e068, sha256:ef476e8be3898d1436fefdf85ec1eb4e76fae5e12652b8fd5547f5b554c333b4 |
| playability.route-completeness@1.0.0 | calculated | 1 ratio | sha256:46fbc34d190b3a43bcc65f4982624b9b436c0a4ac528949e9ea88e405a49012e | sha256:e641fc0da01cab3a6aeca640254d6dde4ced839b7de39c7b936909114bb580d6, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:e80a2298bdeb760bab417a3b60d8214f8a01599df02405af75e538052c23a5b0, sha256:6abf9e53f8062a3655ed0d8b01ad563db189ee5d8d52697122e7f279d55d5455, sha256:f8b56ab83d81660725b7343cfb2c6c9ee6026e600f767f5226e4b7cd5fd1a0eb, sha256:20ac2f73dcd6df9fb034d0363d3a27c06b7ad5cabc1dbbff90c151438773a262 |
| playability.skip-candidate-count@1.0.0 | calculated | 0 candidates | sha256:2bb22bd4f70d439889575f9bdfd53478cbf77920abe8ea189fcd91131ebcc65b | sha256:ef476e8be3898d1436fefdf85ec1eb4e76fae5e12652b8fd5547f5b554c333b4 |
| policy.decorative-collision-violations@1.0.0 | calculated | 0 objects | sha256:bd4a4ba919c0dad0ad9ada70591394bc2545dfc883dab4ef8a6fc40f190a8659 | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| policy.evidence-completeness@1.0.0 | blocked-by-invariant | unavailable | sha256:49890a459db60f93745fc933544a7681ecda3863c5a5bee9f011d42f1b6ceded | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| runtime.checkpoint-isolation-availability@1.0.0 | unavailable | unavailable | sha256:7e333c7b026abdc2d2efba334c347f290df3f4d6a606ad04379bc169cbd43cba | none |

## Category and profile results

| Category | Status | Metrics | Blocked by |
| --- | --- | --- | --- |
| checkpoint | available | checkpoint.topology-validity, runtime.checkpoint-isolation-availability | none |
| hazard | available | hazard.relationship-candidate-count | none |
| performance | available | performance.native-part-count | none |
| playability | incomplete | finish.topology-validity, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count | finish-topology |
| policy | missing-evidence | policy.decorative-collision-violations, policy.evidence-completeness | required-metric-availability |

### Profile gates

| Gate | Metric | State | Classification | Evidence hashes |
| --- | --- | --- | --- | --- |
| required-transition-feasibility | playability.required-transition-feasibility | pass | provisional | sha256:e44b81645bedb750c6377eaa6e51e3dfbbc6a41fa473e7c149df0ef18db046c7, sha256:3cfa63691a4771e01e2037c8569a584f6812f74060e54422f7067567473bcddc, sha256:5fa821bb79023bb2a7053f82a4359074c4df491503c30f2c2cd66d8a13a9dad9, sha256:6fffd3e4743ea9bbe407bf7ac5b7896eb8bdb2e2cbd1cefdd238e8206e87e068, sha256:ef476e8be3898d1436fefdf85ec1eb4e76fae5e12652b8fd5547f5b554c333b4 |

## Findings

- [info] Checkpoint runtime isolation is missing evidence (finding.checkpoint.runtime-isolation-missing.1)
- [warning] KillFloor bounds candidate (finding.hazard.kill-floor-bounds-candidate.0)
- [blocking] Invariant failed: finish-topology (finding.invariant.finish-topology)

## Evidence index

| Evidence ID | Kind | Subject | Content hash |
| --- | --- | --- | --- |
| e1b:checkpoint:1 | checkpoint-topology | object:Checkpoint01 | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d |
| e1b:coarse-transition:0 | coarse-transition-state | transition:Spawn:JumpPlatform01:0:1 | sha256:3cfa63691a4771e01e2037c8569a584f6812f74060e54422f7067567473bcddc |
| e1b:coarse-transition:1 | coarse-transition-state | transition:JumpPlatform01:Checkpoint01:1:2 | sha256:5fa821bb79023bb2a7053f82a4359074c4df491503c30f2c2cd66d8a13a9dad9 |
| e1b:coarse-transition:2 | coarse-transition-state | transition:Checkpoint01:WedgeClimb01:2:3 | sha256:6fffd3e4743ea9bbe407bf7ac5b7896eb8bdb2e2cbd1cefdd238e8206e87e068 |
| e1b:coarse-transition:3 | coarse-transition-state | transition:WedgeClimb01:FinishPlatform:3:4 | sha256:e44b81645bedb750c6377eaa6e51e3dfbbc6a41fa473e7c149df0ef18db046c7 |
| e1b:finish | finish-topology | scene | sha256:e641fc0da01cab3a6aeca640254d6dde4ced839b7de39c7b936909114bb580d6 |
| e1b:geometry:scene | geometry-fact | scene | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| e1b:hazard:KillFloor:bounds | hazard-relationship | scene | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836 |
| e1b:hazard:KillFloor:enclosure | hazard-relationship | scene | sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023 |
| e1b:route-graph | route-graph | scene | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| e1b:route-playability-summary | route-playability-summary | scene | sha256:ef476e8be3898d1436fefdf85ec1eb4e76fae5e12652b8fd5547f5b554c333b4 |
| e1b:route-transition:0 | route-transition | transition:Spawn:JumpPlatform01:0:1 | sha256:6abf9e53f8062a3655ed0d8b01ad563db189ee5d8d52697122e7f279d55d5455 |
| e1b:route-transition:1 | route-transition | transition:JumpPlatform01:Checkpoint01:1:2 | sha256:f8b56ab83d81660725b7343cfb2c6c9ee6026e600f767f5226e4b7cd5fd1a0eb |
| e1b:route-transition:2 | route-transition | transition:Checkpoint01:WedgeClimb01:2:3 | sha256:20ac2f73dcd6df9fb034d0363d3a27c06b7ad5cabc1dbbff90c151438773a262 |
| e1b:route-transition:3 | route-transition | transition:WedgeClimb01:FinishPlatform:3:4 | sha256:e80a2298bdeb760bab417a3b60d8214f8a01599df02405af75e538052c23a5b0 |

## Unavailable and deferred capabilities

- runtime.checkpoint-isolation-availability: studio-runtime-deferred; capability=runtime; Metric runtime.checkpoint-isolation-availability is unavailable because studio-runtime-deferred.

## Limitations

- candidate-semantics: Hazard and skip candidates are not confirmed gameplay failures.
- coarse-model-only: Model-relative transition feasibility is not universal Roblox physics proof.
- runtime-deferred: Studio/runtime checkpoint isolation evidence is unavailable in E1c.

## Reproduction information

Calculation bundle identity: sha256:4c3a74ff52a2b84091a92299d71192e83a62562849f1c8123c103ffd9b409cb0
- checkpoint.topology-validity: method=checkpoint-topology-validity@1.0.0; parameters=sha256:627ad7bbff54fadf25f6cf2c01e7f7bd23f982955709a4d5120ce4e31d92f844; inputs=sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- finish.topology-validity: method=finish-topology-validity@1.0.0; parameters=sha256:725aea11d385785d840a6796ab89bf611ffd9f825aed11c5e467a97a77a7f96b; inputs=sha256:e641fc0da01cab3a6aeca640254d6dde4ced839b7de39c7b936909114bb580d6
- hazard.relationship-candidate-count: method=hazard-candidate-count@1.0.0; parameters=sha256:cb6ae3258b1c00673b26c8a192093bda5fc192fb2b7fecbbc58c044bee53f0d2; inputs=sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:ef476e8be3898d1436fefdf85ec1eb4e76fae5e12652b8fd5547f5b554c333b4
- performance.native-part-count: method=native-part-count@1.0.0; parameters=sha256:4d5f76b2eb5cd49eb980eb5cde0215a5b799421dbc10eb0347ba42550a49a8e3; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- playability.required-transition-feasibility: method=required-transition-feasibility@1.0.0; parameters=sha256:a5a55862fa291f9925c183323c00803ffaff239acc7bb77e0928d245b20a8958; inputs=sha256:e44b81645bedb750c6377eaa6e51e3dfbbc6a41fa473e7c149df0ef18db046c7, sha256:3cfa63691a4771e01e2037c8569a584f6812f74060e54422f7067567473bcddc, sha256:5fa821bb79023bb2a7053f82a4359074c4df491503c30f2c2cd66d8a13a9dad9, sha256:6fffd3e4743ea9bbe407bf7ac5b7896eb8bdb2e2cbd1cefdd238e8206e87e068, sha256:ef476e8be3898d1436fefdf85ec1eb4e76fae5e12652b8fd5547f5b554c333b4
- playability.route-completeness: method=route-completeness@1.0.0; parameters=sha256:a80bc65a6a5aadf59bc182d5d22b51ee6684aefe7efb89becc33c1a35db7fbb8; inputs=sha256:e641fc0da01cab3a6aeca640254d6dde4ced839b7de39c7b936909114bb580d6, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:e80a2298bdeb760bab417a3b60d8214f8a01599df02405af75e538052c23a5b0, sha256:6abf9e53f8062a3655ed0d8b01ad563db189ee5d8d52697122e7f279d55d5455, sha256:f8b56ab83d81660725b7343cfb2c6c9ee6026e600f767f5226e4b7cd5fd1a0eb, sha256:20ac2f73dcd6df9fb034d0363d3a27c06b7ad5cabc1dbbff90c151438773a262
- playability.skip-candidate-count: method=skip-candidate-count@1.0.0; parameters=sha256:c1b09f64b482198d07981cb4506a02151d87ea151356bc6590f99274afff3a4a; inputs=sha256:ef476e8be3898d1436fefdf85ec1eb4e76fae5e12652b8fd5547f5b554c333b4
- policy.decorative-collision-violations: method=decorative-collision-audit@1.0.0; parameters=sha256:ef49e99ea855fc54174ccae89f6d37db11b149192cfa90724df74e6b7f8fdd60; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- policy.evidence-completeness: method=evidence-completeness@1.0.0; parameters=sha256:8c47899599a7f6bf62890d89335c29e1ea95839cab99822aab48e4e69c880fc9; inputs=sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- runtime.checkpoint-isolation-availability: method=runtime-isolation-availability@1.0.0; parameters=sha256:437a68cd4030436d461a60bbbc560c03bff0740fbbd053f9534603d184c514b2; inputs=none
