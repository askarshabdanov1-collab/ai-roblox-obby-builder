# Roblox Obby Evaluation Report

## Identity summary

Report payload: sha256:3657437ca9263d49ccf240feb81379f9c868a00ff26daf9e3506ade0e2afcd08
Calculation bundle: sha256:8c50acb6375ba03344f63587d61456138f8c10b51900e54b1c98423cb46cfc7f
Manifest: sha256:5487d051f578f0791331199904fd7a3a873aaa421f0552179fd7ff6d23b82eb0
Configuration: sha256:d8559f28afffba3ebdf21e96d69eff465f24d2d8e217c81628cb4b343e043f5a
Evaluation request: sha256:3c5f62063b5b48e2f2d822242c3f0f58d3a35f6ea354a21a7b3a6defe2a440be
Metric catalog: sha256:6792f022f5a928d890e6232d9eafdfe3df9fe910c9554845064a82a58aa24674
Scoring profile: sha256:b572d93ff5914032ccd16a144f4a9c8400e4c32eabf035bba49359e4a3ac71fd
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
| checkpoint.topology-validity@1.0.0 | calculated | true | sha256:034fa5e8bdf98a948891e52309ac2ed8e02d713428715b7cae111ae3c4f885ec | sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
| finish.topology-validity@1.0.0 | calculated | true | sha256:8f69dbab1e658e76fa4c9900260b9137353d6b7d26c383602b6db361012b10ce | sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455 |
| hazard.relationship-candidate-count@1.0.0 | calculated | 1 candidates | sha256:15fdf43ed40d21917b7c47dc508fabbdd862dee0c7ff805d8fda0ce0bc660b6d | sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450 |
| performance.native-part-count@1.0.0 | calculated | 6 objects | sha256:6b2315dcb5bc07379a8702f2a329d3010b9b03676d42b43ac62fc6f117ae5c41 | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| playability.required-transition-feasibility@1.0.0 | calculated | feasible-under-model | sha256:5c4fe9f6855d6ba023988fef29209534330fb2ebbe6f34c488da5e1c3a799e8e | sha256:a9415bad8dfdccf669fd19d03a5a66fb3a76dfbff131b377da47d59d13f66298, sha256:09d315603281973f280819f593568fdc0e8afc054570d78320cc8e62823e381c, sha256:e6405122df2f462ea524f7fc3c6f38b3cebeb68a11ec10b06f442a100d9adee6, sha256:7773b8bab81c2af308c33f45d93c926e77d48293314c276c4fb700905ecf4bbc, sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450 |
| playability.route-completeness@1.0.0 | calculated | 1 ratio | sha256:716dbcf4ce3559e1d18903e30ee0cf1ff24419d72e8e47a16f9ea8b74c0ca42a | sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:5d3c6de8117449f913ede959942c0674615a17faa39a3d2adb4fe1fdeb056ab0, sha256:bae33dae29d4c94a3c086aa39c8d6f645110ec90f975821f6e26fdc8c8d07bb6, sha256:b9e94d17de69aac07027a065375a581157991a3b97df06dcd8e632fe6493dac0, sha256:d3f492c4ac609a36f68896e0bb64be18c74fb398c2f82da250cce2d6d53355f4 |
| playability.skip-candidate-count@1.0.0 | calculated | 1 candidates | sha256:94096aea53992bd648c649c5841af7183723d3cbc8d0e710ae084bbef9d05635 | sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450, sha256:e6c41586540dcc5c25eff9dd0c39db44d753537305a8a14321ae1deaf79f7699 |
| policy.decorative-collision-violations@1.0.0 | calculated | 0 objects | sha256:3fb127c4009dcf03c6e5d3e54cada4aa1860e37cae1744152592cdadb563b60d | sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4 |
| policy.evidence-completeness@1.0.0 | calculated | true | sha256:1a65c6f3f5d4b128fa66895200dfe87d1f0f6c465cec1eea2d89123be75bdba3 | sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32 |
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

Calculation bundle identity: sha256:8c50acb6375ba03344f63587d61456138f8c10b51900e54b1c98423cb46cfc7f
- checkpoint.topology-validity: method=checkpoint-topology-validity@1.0.0; parameters=sha256:9cddd298ef6a09ebc6fa72596894ad03dd18cc3e19d88fb2a2bb28c20b5655e3; inputs=sha256:a279075152055286a1c0d154e1e827ad0bb109cc4ed0d0349c0751659920757d, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- finish.topology-validity: method=finish-topology-validity@1.0.0; parameters=sha256:735c97465044214466f431a649137ab2944d938728a470590c72ff9f4d2367e6; inputs=sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455
- hazard.relationship-candidate-count: method=hazard-candidate-count@1.0.0; parameters=sha256:f7d60fa23a5d37b9addcedd6e564bfb809006abd696db7a85daf5bc4f59a2ac8; inputs=sha256:71f78396645e0dc1d8f4893409e84a5db1ac41e65320dab827719b713f788836, sha256:83af8e3c2b516fa9be044c50f72b4b0f550979aa3f824855b7cabffcd3568023, sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450
- performance.native-part-count: method=native-part-count@1.0.0; parameters=sha256:ff3d4045e11069fbc1b4d59d7aef86603f6ac9484ded88987b94b416b6410133; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- playability.required-transition-feasibility: method=required-transition-feasibility@1.0.0; parameters=sha256:5c436d6b97d5da1c30445d647114bd9eb08f6edcde9a8e8e811bbb5771637c8f; inputs=sha256:a9415bad8dfdccf669fd19d03a5a66fb3a76dfbff131b377da47d59d13f66298, sha256:09d315603281973f280819f593568fdc0e8afc054570d78320cc8e62823e381c, sha256:e6405122df2f462ea524f7fc3c6f38b3cebeb68a11ec10b06f442a100d9adee6, sha256:7773b8bab81c2af308c33f45d93c926e77d48293314c276c4fb700905ecf4bbc, sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450
- playability.route-completeness: method=route-completeness@1.0.0; parameters=sha256:9a0d33144b65c98f3f5bde17db3404b152ef9dfc4aed9cd762b833b44af57208; inputs=sha256:a6ad627091da9a54a3fe8f3515a41e866100ea76e3642800c42b948625c07455, sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32, sha256:5d3c6de8117449f913ede959942c0674615a17faa39a3d2adb4fe1fdeb056ab0, sha256:bae33dae29d4c94a3c086aa39c8d6f645110ec90f975821f6e26fdc8c8d07bb6, sha256:b9e94d17de69aac07027a065375a581157991a3b97df06dcd8e632fe6493dac0, sha256:d3f492c4ac609a36f68896e0bb64be18c74fb398c2f82da250cce2d6d53355f4
- playability.skip-candidate-count: method=skip-candidate-count@1.0.0; parameters=sha256:89851f87163b25c92c4b9a430c3b1a9f360a88d42e1225a330312b2dbf3a8d8c; inputs=sha256:2117cfc96bc50f8a2069f96bc761aa3a3bcbd17aac9c92d7cc4729d550cfa450, sha256:e6c41586540dcc5c25eff9dd0c39db44d753537305a8a14321ae1deaf79f7699
- policy.decorative-collision-violations: method=decorative-collision-audit@1.0.0; parameters=sha256:d0e9aef7dd93f130b3e87dbc80582b62997c50aa547fda1eee95d198bf1e5e33; inputs=sha256:83d14efe7bf8f7b9b6e7d4caa2881ce3e7e62e57103723fcda4219f668acc7f4
- policy.evidence-completeness: method=evidence-completeness@1.0.0; parameters=sha256:bf61d9ac4b9ec51013b360ffae76dc30a832a4c25fd0302a76c314b3ebe85226; inputs=sha256:501724c9f67b862356a73ccd2c8d42509c2f6059ccc20143e16630455c641b32
- runtime.checkpoint-isolation-availability: method=runtime-isolation-availability@1.0.0; parameters=sha256:39f876311dbf8609790380cbb93a1c96fd0868f4a47d1d27a6ffe380cc741afe; inputs=none
