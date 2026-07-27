# Roblox Obby Evaluation Report

## Identity summary

Report payload: sha256:35763dab9244241c9ddcde874b16c39abad3eb5edb8d97d3e5f28acbda93eb6a
Calculation bundle: sha256:8931fff75bf797e3ed72171c575195f69d946ee8316d2595e15210c742587d84
Manifest: sha256:5487d051f578f0791331199904fd7a3a873aaa421f0552179fd7ff6d23b82eb0
Configuration: sha256:d8559f28afffba3ebdf21e96d69eff465f24d2d8e217c81628cb4b343e043f5a
Evaluation request: sha256:3c5f62063b5b48e2f2d822242c3f0f58d3a35f6ea354a21a7b3a6defe2a440be
Metric catalog: sha256:6792f022f5a928d890e6232d9eafdfe3df9fe910c9554845064a82a58aa24674
Scoring profile: sha256:b572d93ff5914032ccd16a144f4a9c8400e4c32eabf035bba49359e4a3ac71fd
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
| required-metric-availability | missing-evidence | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 | none |
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
| checkpoint.topology-validity@1.0.0 | calculated | true | sha256:034fa5e8bdf98a948891e52309ac2ed8e02d713428715b7cae111ae3c4f885ec | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| finish.topology-validity@1.0.0 | calculated | true | sha256:fb91b56d98d09bd36d0cbdf6bf5f07671f64a775fb9a402e1407f98a839aeeac | sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1 |
| hazard.relationship-candidate-count@1.0.0 | calculated | 1 candidates | sha256:9bb6b703d2fd370c9c52fd526b547e8462dc050547a76c8474c93f2a9be27d9b | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326 |
| performance.native-part-count@1.0.0 | calculated | 6 objects | sha256:6b2315dcb5bc07379a8702f2a329d3010b9b03676d42b43ac62fc6f117ae5c41 | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| playability.required-transition-feasibility@1.0.0 | indeterminate | indeterminate | sha256:a6bb0691219cd0b9a0c767700a1ba9980b786d1180fc48b28ee39609bac43c21 | sha256:1014ef52c4901d772b644e8034486861627700cfc4c6ba81ac1e5cee6c0bf681, sha256:4529b9f6fa4e96d38a1abce534f0d47ff9ac7203e380d2f4e075d3db82289248, sha256:7fcdb21ee6b74c985a57a0a42743e0a4505318acbe41aa242e361e994632f1e7, sha256:68b3880ebfc5069e85f42d6d373a69f98b84226dc98ce8accf5b7472d99d5904, sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326 |
| playability.route-completeness@1.0.0 | calculated | 1 ratio | sha256:ae7a7a3168e0b807255606d33b8f5b737248ab16dbc0f657002da36be68f606e | sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:0f78329bf137c581993a2ad5e94862930289de774415d050a0ebcf8a2472c22a, sha256:479bff4d832c1b7e00bcc9048dcfe96739b7122e422457c294a41754e55bb1ff, sha256:948bbcc255fe576a0a231bed2ddb5526148f19bed67a6b3a2284d751b20268d6, sha256:3eafbf398b62fa8dbfed566d29d7c98cd114597797f6d2c4ec72e28bf201e74f |
| playability.skip-candidate-count@1.0.0 | calculated | 0 candidates | sha256:f1d496f25391697d61c469c7a77f75a3ecc0b1eecec04258ebbc8fc610bf4cec | sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326 |
| policy.decorative-collision-violations@1.0.0 | calculated | 0 objects | sha256:3fb127c4009dcf03c6e5d3e54cada4aa1860e37cae1744152592cdadb563b60d | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| policy.evidence-completeness@1.0.0 | calculated | true | sha256:944c32e698f027371661334f1e91152eaaea46e59b3a4f7198153c08dc8aeb7f | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| runtime.checkpoint-isolation-availability@1.0.0 | unavailable | unavailable | sha256:03e38f043aec59af61321c048d3585777a79239cced67cfc1051806608ded359 | none |

## Category and profile results

| Category | Status | Metrics |
| --- | --- | --- |
| checkpoint | available | checkpoint.topology-validity, runtime.checkpoint-isolation-availability |
| hazard | available | hazard.relationship-candidate-count |
| performance | available | performance.native-part-count |
| playability | incomplete | finish.topology-validity, playability.required-transition-feasibility, playability.route-completeness, playability.skip-candidate-count |
| policy | available | policy.decorative-collision-violations, policy.evidence-completeness |

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

Calculation bundle identity: sha256:8931fff75bf797e3ed72171c575195f69d946ee8316d2595e15210c742587d84
- checkpoint.topology-validity: method=checkpoint-topology-validity@1.0.0; parameters=sha256:9cddd298ef6a09ebc6fa72596894ad03dd18cc3e19d88fb2a2bb28c20b5655e3; inputs=sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- finish.topology-validity: method=finish-topology-validity@1.0.0; parameters=sha256:735c97465044214466f431a649137ab2944d938728a470590c72ff9f4d2367e6; inputs=sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1
- hazard.relationship-candidate-count: method=hazard-candidate-count@1.0.0; parameters=sha256:f7d60fa23a5d37b9addcedd6e564bfb809006abd696db7a85daf5bc4f59a2ac8; inputs=sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326
- performance.native-part-count: method=native-part-count@1.0.0; parameters=sha256:ff3d4045e11069fbc1b4d59d7aef86603f6ac9484ded88987b94b416b6410133; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- playability.required-transition-feasibility: method=required-transition-feasibility@1.0.0; parameters=sha256:5c436d6b97d5da1c30445d647114bd9eb08f6edcde9a8e8e811bbb5771637c8f; inputs=sha256:1014ef52c4901d772b644e8034486861627700cfc4c6ba81ac1e5cee6c0bf681, sha256:4529b9f6fa4e96d38a1abce534f0d47ff9ac7203e380d2f4e075d3db82289248, sha256:7fcdb21ee6b74c985a57a0a42743e0a4505318acbe41aa242e361e994632f1e7, sha256:68b3880ebfc5069e85f42d6d373a69f98b84226dc98ce8accf5b7472d99d5904, sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326
- playability.route-completeness: method=route-completeness@1.0.0; parameters=sha256:9a0d33144b65c98f3f5bde17db3404b152ef9dfc4aed9cd762b833b44af57208; inputs=sha256:e117d3d6f4417d70e4ecc17a2df47492e35226efebe1559da13b687831113ed1, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:0f78329bf137c581993a2ad5e94862930289de774415d050a0ebcf8a2472c22a, sha256:479bff4d832c1b7e00bcc9048dcfe96739b7122e422457c294a41754e55bb1ff, sha256:948bbcc255fe576a0a231bed2ddb5526148f19bed67a6b3a2284d751b20268d6, sha256:3eafbf398b62fa8dbfed566d29d7c98cd114597797f6d2c4ec72e28bf201e74f
- playability.skip-candidate-count: method=skip-candidate-count@1.0.0; parameters=sha256:89851f87163b25c92c4b9a430c3b1a9f360a88d42e1225a330312b2dbf3a8d8c; inputs=sha256:a748aa428d560d45d7240db2728dab0a4323479f3c47c0fc4933cb3673925326
- policy.decorative-collision-violations: method=decorative-collision-audit@1.0.0; parameters=sha256:d0e9aef7dd93f130b3e87dbc80582b62997c50aa547fda1eee95d198bf1e5e33; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- policy.evidence-completeness: method=evidence-completeness@1.0.0; parameters=sha256:bf61d9ac4b9ec51013b360ffae76dc30a832a4c25fd0302a76c314b3ebe85226; inputs=sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- runtime.checkpoint-isolation-availability: method=runtime-isolation-availability@1.0.0; parameters=sha256:39f876311dbf8609790380cbb93a1c96fd0868f4a47d1d27a6ffe380cc741afe; inputs=none
