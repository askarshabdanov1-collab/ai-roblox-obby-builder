import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  acceptAuthenticatedMessage,
  acceptStudioEvidence,
  advanceStudioLifecycle,
  claimLoopbackControl,
  createLoopbackControlLease,
  createEphemeralSessionSecret,
  createLoopbackSession,
  createStudioLifecycle,
  hashStudioPayload,
  negotiateStudioCapabilities,
  signLoopbackMessage,
  type StudioBinding,
} from "../src/studio-feasibility.js";

const encoder = new TextEncoder();

type StudioFeasibilityPluginProject = {
  tree: {
    $className: string;
    StudioFeasibility: {
      $path: string;
    };
  };
};

const binding: StudioBinding = {
  executionId: "execution-001",
  sceneId: "scene-001",
  generatedRootOwner: "AIObbyBuilder/0.3",
  manifestHash:
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  sceneGeneration: "generation-001",
  playtestSessionId: "playtest-001",
};

function capabilityOffer(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: "1.0.0",
    studioVersion: "0.732.0.7321040",
    windowsVersion: "Windows 10 Pro 10.0.19045 build 19045",
    pluginVersion: "not-built",
    bridgeVersion: "not-built",
    orchestratorVersion: "0.2.0",
    adapterId: "studio-feasibility-model-v1",
    transports: ["http-polling", "signed-bundle-exchange"],
    playtestModes: ["single-player"],
    captureCapabilities: ["none"],
    securityFeatures: [
      "loopback-only-v1",
      "message-auth-v1",
      "sequence-v1",
      "expiry-v1",
      "payload-digest-v1",
      "integrity-v1",
    ],
    maximumPayloadBytes: 1024,
    ...overrides,
  };
}

describe("Studio feasibility capability negotiation", () => {
  it("selects only the compatible documented intersection", () => {
    const result = negotiateStudioCapabilities({
      local: capabilityOffer(),
      peer: capabilityOffer({ transports: ["signed-bundle-exchange"] }),
      requiredCapabilities: ["single-player", "integrity-v1"],
      selectedTransport: "signed-bundle-exchange",
    });

    expect(result).toEqual({
      ok: true,
      selectedTransport: "signed-bundle-exchange",
      maximumPayloadBytes: 1024,
      multiplayerStatus: "unsupported-unproven",
    });
  });

  it("fails closed for an unknown major, missing integrity, and an unapproved adapter", () => {
    expect(
      negotiateStudioCapabilities({
        local: capabilityOffer(),
        peer: capabilityOffer({ protocolVersion: "2.0.0" }),
        requiredCapabilities: [],
        selectedTransport: "http-polling",
      }),
    ).toMatchObject({ ok: false, code: "protocol-major-mismatch" });

    expect(
      negotiateStudioCapabilities({
        local: capabilityOffer(),
        peer: capabilityOffer({ securityFeatures: ["message-auth-v1"] }),
        requiredCapabilities: [],
        selectedTransport: "http-polling",
      }),
    ).toMatchObject({ ok: false, code: "missing-integrity-feature" });

    expect(
      negotiateStudioCapabilities({
        local: capabilityOffer(),
        peer: capabilityOffer({ adapterId: "unreviewed-adapter-v9" }),
        requiredCapabilities: [],
        selectedTransport: "http-polling",
      }),
    ).toMatchObject({ ok: false, code: "unapproved-adapter" });
  });
});

describe("Studio feasibility local plugin artifact", () => {
  it("uses an importable Model root with exactly the local-plugin Script source", () => {
    const project = JSON.parse(
      readFileSync(
        new URL(
          "../../../roblox/studio-feasibility.plugin.project.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as StudioFeasibilityPluginProject;

    expect(project.tree).toEqual({
      $className: "Model",
      StudioFeasibility: {
        $path: "studio-feasibility/StudioFeasibility.plugin.luau",
      },
    });
  });

  it("arms activation only in process memory and starts after Play exposes the generated root", () => {
    const source = readFileSync(
      new URL(
        "../../../roblox/studio-feasibility/StudioFeasibility.plugin.luau",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("local armed = false");
    for (const button of ["arm", "submitEvidence", "stop", "recover"]) {
      expect(source).toContain(`${button}.Activated:Connect(function()`);
      expect(source).not.toContain(`${button}.Click:Connect(function()`);
    }
    expect(source).toContain("RunService.Heartbeat:Connect(function()");
    expect(source).toContain("not RunService:IsRunning()");
    expect(source).toContain('send("reconcile"');
    expect(source).toContain('send("start", {})');
    expect(source).not.toContain("plugin:SetSetting");
    expect(source).not.toContain("plugin:GetSetting");
  });
});

describe("authenticated loopback messages", () => {
  it("creates a bounded ephemeral session secret", () => {
    const secret = createEphemeralSessionSecret();
    expect(secret).toHaveLength(32);
    expect(secret).not.toEqual(createEphemeralSessionSecret());
  });

  it("accepts one bounded message and rejects replayed, expired, oversized, and non-loopback input", () => {
    const secret = encoder.encode("0123456789abcdef0123456789abcdef");
    let session = createLoopbackSession({
      sessionId: "session-001",
      secret,
      peerAddress: "127.0.0.1",
      expectedOrigin: "studio-feasibility://local",
      expiresAtEpochMs: 10_000,
      maximumPayloadBytes: 32,
      allowedCommands: ["start", "stop", "submit-evidence"],
    });
    const payload = encoder.encode('{"stage":"start"}');
    const unsigned = {
      protocolVersion: "1.0.0",
      sessionId: "session-001",
      sequence: 1,
      requestId: "request-001",
      expiresAtEpochMs: 5_000,
      command: "start" as const,
      payload,
      payloadDigest: hashStudioPayload(payload),
      peerAddress: "127.0.0.1",
      origin: "studio-feasibility://local",
    };
    const message = {
      ...unsigned,
      payloadDigest: hashStudioPayload(payload),
      authenticationTag: signLoopbackMessage(secret, unsigned),
    };

    const accepted = acceptAuthenticatedMessage(session, message, 1_000);
    expect(accepted.result).toEqual({ ok: true, nextSequence: 2 });
    session = accepted.session;

    expect(
      acceptAuthenticatedMessage(session, message, 1_001).result,
    ).toMatchObject({
      ok: false,
      code: "replayed-sequence",
    });
    expect(
      acceptAuthenticatedMessage(
        session,
        { ...message, expiresAtEpochMs: 999 },
        1_000,
      ).result,
    ).toMatchObject({ ok: false, code: "expired-message" });
    expect(
      acceptAuthenticatedMessage(
        session,
        { ...message, sequence: 2, peerAddress: "192.168.1.10" },
        1_000,
      ).result,
    ).toMatchObject({ ok: false, code: "non-loopback-peer" });
    expect(
      acceptAuthenticatedMessage(
        session,
        { ...message, sequence: 2, payload: encoder.encode("x".repeat(33)) },
        1_000,
      ).result,
    ).toMatchObject({ ok: false, code: "payload-too-large" });
  });

  it("allows exactly one active controlling session", () => {
    let lease = createLoopbackControlLease();
    const claimed = claimLoopbackControl(lease, "session-001");
    expect(claimed.result).toEqual({ ok: true });
    lease = claimed.lease;
    expect(claimLoopbackControl(lease, "session-002").result).toMatchObject({
      ok: false,
      code: "control-session-active",
    });
  });
});

describe("single-player lifecycle and evidence binding", () => {
  it("rejects stale, wrong-scene, wrong-generation, oversized, and interrupted evidence", () => {
    let lifecycle = createStudioLifecycle(binding);
    lifecycle = advanceStudioLifecycle(lifecycle, {
      kind: "begin",
      nowEpochMs: 1_000,
    }).lifecycle;
    lifecycle = advanceStudioLifecycle(lifecycle, {
      kind: "confirm-scene",
      binding,
      nowEpochMs: 1_001,
    }).lifecycle;
    lifecycle = advanceStudioLifecycle(lifecycle, {
      kind: "start-playtest",
      nowEpochMs: 1_002,
    }).lifecycle;
    expect(lifecycle.status).toBe("running");

    const accepted = acceptStudioEvidence(lifecycle, {
      ...binding,
      sequence: 1,
      payload: encoder.encode("observation-1"),
      payloadDigest: hashStudioPayload(encoder.encode("observation-1")),
      completionMarker: true,
    });
    expect(accepted.result).toEqual({ ok: true, nextSequence: 2 });
    lifecycle = accepted.lifecycle;

    expect(
      acceptStudioEvidence(lifecycle, {
        ...binding,
        sequence: 1,
        payload: encoder.encode("observation-1"),
        payloadDigest: hashStudioPayload(encoder.encode("observation-1")),
        completionMarker: true,
      }).result,
    ).toMatchObject({ ok: false, code: "replayed-evidence" });
    expect(
      acceptStudioEvidence(lifecycle, {
        ...binding,
        sceneId: "scene-other",
        sequence: 2,
        payload: encoder.encode("observation-2"),
        payloadDigest: hashStudioPayload(encoder.encode("observation-2")),
        completionMarker: true,
      }).result,
    ).toMatchObject({ ok: false, code: "wrong-scene" });
    expect(
      acceptStudioEvidence(lifecycle, {
        ...binding,
        sceneGeneration: "generation-other",
        sequence: 2,
        payload: encoder.encode("observation-2"),
        payloadDigest: hashStudioPayload(encoder.encode("observation-2")),
        completionMarker: true,
      }).result,
    ).toMatchObject({ ok: false, code: "wrong-generation" });
    expect(
      acceptStudioEvidence(lifecycle, {
        ...binding,
        sequence: 2,
        payload: encoder.encode("x".repeat(1025)),
        payloadDigest: hashStudioPayload(encoder.encode("x".repeat(1025))),
        completionMarker: true,
      }).result,
    ).toMatchObject({ ok: false, code: "evidence-too-large" });

    lifecycle = advanceStudioLifecycle(lifecycle, {
      kind: "interrupted",
      nowEpochMs: 1_003,
    }).lifecycle;
    expect(lifecycle.status).toBe("reconciliation-required");
    expect(
      acceptStudioEvidence(lifecycle, {
        ...binding,
        sequence: 2,
        payload: encoder.encode("observation-2"),
        payloadDigest: hashStudioPayload(encoder.encode("observation-2")),
        completionMarker: true,
      }).result,
    ).toMatchObject({ ok: false, code: "interrupted-evidence" });
  });

  it("locks automation after a lease expiry or interrupted reconciliation until recovery is explicit", () => {
    let lifecycle = createStudioLifecycle(binding);
    lifecycle = advanceStudioLifecycle(lifecycle, {
      kind: "begin",
      nowEpochMs: 2_000,
    }).lifecycle;
    lifecycle = advanceStudioLifecycle(lifecycle, {
      kind: "confirm-scene",
      binding,
      nowEpochMs: 2_001,
    }).lifecycle;
    lifecycle = advanceStudioLifecycle(lifecycle, {
      kind: "start-playtest",
      nowEpochMs: 2_002,
    }).lifecycle;
    lifecycle = advanceStudioLifecycle(lifecycle, {
      kind: "lease-expired",
      nowEpochMs: 2_003,
    }).lifecycle;
    expect(lifecycle).toMatchObject({
      status: "cleanup-uncertain",
      automationLocked: true,
    });

    let interrupted = createStudioLifecycle(binding);
    interrupted = advanceStudioLifecycle(interrupted, {
      kind: "begin",
      nowEpochMs: 3_000,
    }).lifecycle;
    interrupted = advanceStudioLifecycle(interrupted, {
      kind: "interrupted",
      nowEpochMs: 3_001,
    }).lifecycle;
    interrupted = advanceStudioLifecycle(interrupted, {
      kind: "reconcile",
      binding: { ...binding, sceneGeneration: "generation-stale" },
      cleanupState: "uncertain",
      nowEpochMs: 3_002,
    }).lifecycle;
    expect(interrupted).toMatchObject({
      status: "manual-recovery-required",
      automationLocked: true,
    });
    interrupted = advanceStudioLifecycle(interrupted, {
      kind: "manual-recovery-complete",
      confirmedByUser: true,
      nowEpochMs: 3_003,
    }).lifecycle;
    expect(interrupted).toMatchObject({
      status: "reconciled",
      automationLocked: false,
    });
  });
});
