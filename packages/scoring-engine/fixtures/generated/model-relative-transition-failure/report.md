# Roblox Obby Evaluation Report

## Identity summary

Report payload: sha256:d85a9b59f4bf7279b521155dd19abf764aed4740d6884a45bcbb19701303fddd
Calculation bundle: sha256:c799894f4d4a01990baa81c66412bcc64dff756fffe763112ecd7dfa6cfc8d0b
Manifest: sha256:5487d051f578f0791331199904fd7a3a873aaa421f0552179fd7ff6d23b82eb0
Configuration: sha256:d8559f28afffba3ebdf21e96d69eff465f24d2d8e217c81628cb4b343e043f5a
Evaluation request: sha256:3c5f62063b5b48e2f2d822242c3f0f58d3a35f6ea354a21a7b3a6defe2a440be
Metric catalog: sha256:6792f022f5a928d890e6232d9eafdfe3df9fe910c9554845064a82a58aa24674
Scoring profile: sha256:b572d93ff5914032ccd16a144f4a9c8400e4c32eabf035bba49359e4a3ac71fd
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
| checkpoint.topology-validity@1.0.0 | calculated | true | sha256:034fa5e8bdf98a948891e52309ac2ed8e02d713428715b7cae111ae3c4f885ec | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| finish.topology-validity@1.0.0 | calculated | true | sha256:1297ac8e078d4dce47d2690bede127a52f35c63ae1aec000251590fbbf86ede9 | sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e |
| hazard.relationship-candidate-count@1.0.0 | calculated | 1 candidates | sha256:ee7494863e4a65ea3b3801720f2b94bd772339a34393db35b09d10513e609df9 | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801 |
| performance.native-part-count@1.0.0 | calculated | 6 objects | sha256:6b2315dcb5bc07379a8702f2a329d3010b9b03676d42b43ac62fc6f117ae5c41 | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| playability.required-transition-feasibility@1.0.0 | calculated | infeasible-under-model | sha256:f7adb5db101291df068429fd7da807c15bc19e858258a9dc7f48efb6b1005d55 | sha256:21eb59507e84ba6ac667c0daa0b7fb577afa6218db8b3a770b50ae3e04e21547, sha256:9d659ac760f4911fdf3cb542e72ea2964947c31a2af7c7736f7a7334bc75da01, sha256:fe54f99acadde93466176b48c95592585c3b1d4e41037a8fe8cb1c2203ea814c, sha256:396b61b581110a29ab1f419829ce6ff1058e6e1ccaff5fae3faf3b75596e08ff, sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801 |
| playability.route-completeness@1.0.0 | calculated | 1 ratio | sha256:2c50f722f1aeb4aad881c1313c7a6a0df8f3e159301c39652bb96bb9c5fb59a6 | sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:3ec0dd0470186f9ff660d45cbdb7d597a057bdc4fe7935f93cf6f955356564ab, sha256:0350eadd7f20a3d45effa6f582986fdc40d08bd5d3aaff9b20c3f73734461964, sha256:77be5b9fda588125b65bbc22a1a0ef28321f81b4da04b8e385643b128478dd3a, sha256:133ee003566f27866944027d41931ba9333418b297dae3e77069befd3cb308c9 |
| playability.skip-candidate-count@1.0.0 | calculated | 0 candidates | sha256:4a2bbfaf4f24ccf17c10056ab2ea5ce85a65f31db57923cd6432a5b97d9280ac | sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801 |
| policy.decorative-collision-violations@1.0.0 | calculated | 0 objects | sha256:3fb127c4009dcf03c6e5d3e54cada4aa1860e37cae1744152592cdadb563b60d | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| policy.evidence-completeness@1.0.0 | calculated | true | sha256:fe2b1c60a0e454d69fa82bd66edfd02f03068d8144c177e1f5cc026f568c1858 | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| runtime.checkpoint-isolation-availability@1.0.0 | unavailable | unavailable | sha256:03e38f043aec59af61321c048d3585777a79239cced67cfc1051806608ded359 | none |

## Category and profile results

| Category | Status | Metrics |
| --- | --- | --- |
| checkpoint | available | checkpoint.topology-validity, runtime.checkpoint-isolation-availability |
| hazard | available | hazard.relationship-candidate-count |
| performance | available | performance.native-part-count |
| playability | available | finish.topology-validity, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count |
| policy | available | policy.decorative-collision-violations, policy.evidence-completeness |

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

Calculation bundle identity: sha256:c799894f4d4a01990baa81c66412bcc64dff756fffe763112ecd7dfa6cfc8d0b
- checkpoint.topology-validity: method=checkpoint-topology-validity@1.0.0; parameters=sha256:9cddd298ef6a09ebc6fa72596894ad03dd18cc3e19d88fb2a2bb28c20b5655e3; inputs=sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- finish.topology-validity: method=finish-topology-validity@1.0.0; parameters=sha256:735c97465044214466f431a649137ab2944d938728a470590c72ff9f4d2367e6; inputs=sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e
- hazard.relationship-candidate-count: method=hazard-candidate-count@1.0.0; parameters=sha256:f7d60fa23a5d37b9addcedd6e564bfb809006abd696db7a85daf5bc4f59a2ac8; inputs=sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801
- performance.native-part-count: method=native-part-count@1.0.0; parameters=sha256:ff3d4045e11069fbc1b4d59d7aef86603f6ac9484ded88987b94b416b6410133; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- playability.required-transition-feasibility: method=required-transition-feasibility@1.0.0; parameters=sha256:5c436d6b97d5da1c30445d647114bd9eb08f6edcde9a8e8e811bbb5771637c8f; inputs=sha256:21eb59507e84ba6ac667c0daa0b7fb577afa6218db8b3a770b50ae3e04e21547, sha256:9d659ac760f4911fdf3cb542e72ea2964947c31a2af7c7736f7a7334bc75da01, sha256:fe54f99acadde93466176b48c95592585c3b1d4e41037a8fe8cb1c2203ea814c, sha256:396b61b581110a29ab1f419829ce6ff1058e6e1ccaff5fae3faf3b75596e08ff, sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801
- playability.route-completeness: method=route-completeness@1.0.0; parameters=sha256:9a0d33144b65c98f3f5bde17db3404b152ef9dfc4aed9cd762b833b44af57208; inputs=sha256:4912a373cc17aff9b19d32db5394b89bb3ea029d196369e02b68b7683928be8e, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:3ec0dd0470186f9ff660d45cbdb7d597a057bdc4fe7935f93cf6f955356564ab, sha256:0350eadd7f20a3d45effa6f582986fdc40d08bd5d3aaff9b20c3f73734461964, sha256:77be5b9fda588125b65bbc22a1a0ef28321f81b4da04b8e385643b128478dd3a, sha256:133ee003566f27866944027d41931ba9333418b297dae3e77069befd3cb308c9
- playability.skip-candidate-count: method=skip-candidate-count@1.0.0; parameters=sha256:89851f87163b25c92c4b9a430c3b1a9f360a88d42e1225a330312b2dbf3a8d8c; inputs=sha256:e40cb5636f4af43e65bd41a13452b52a1848756e04bc9e5115b0de639811a801
- policy.decorative-collision-violations: method=decorative-collision-audit@1.0.0; parameters=sha256:d0e9aef7dd93f130b3e87dbc80582b62997c50aa547fda1eee95d198bf1e5e33; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- policy.evidence-completeness: method=evidence-completeness@1.0.0; parameters=sha256:bf61d9ac4b9ec51013b360ffae76dc30a832a4c25fd0302a76c314b3ebe85226; inputs=sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- runtime.checkpoint-isolation-availability: method=runtime-isolation-availability@1.0.0; parameters=sha256:39f876311dbf8609790380cbb93a1c96fd0868f4a47d1d27a6ffe380cc741afe; inputs=none
