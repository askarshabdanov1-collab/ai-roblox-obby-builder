import { describe, expect, it } from "vitest";

import {
  createSignedBridgeMessage,
  StudioFeasibilityBridge,
} from "../src/studio-feasibility-bridge.js";
import { hashStudioPayload } from "../src/studio-feasibility.js";

const encoder = new TextEncoder();

function bridge() {
  return new StudioFeasibilityBridge(4318, 1_000, 60_000);
}

function capabilityOffer(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: "1.0.0",
    studioVersion: "0.732.0.7321043",
    windowsVersion: "Windows 10 Pro 22H2",
    pluginVersion: "0.1.0-dev",
    bridgeVersion: "0.1.0-dev",
    orchestratorVersion: "0.2.0",
    adapterId: "studio-feasibility-model-v1",
    transports: ["http-polling"],
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
    maximumPayloadBytes: 65_536,
    ...overrides,
  };
}

function binding(instance: StudioFeasibilityBridge) {
  return {
    executionId: instance.activation.executionId,
    sceneId: "place-0",
    generatedRootOwner: "AIObbyBuilder/0.3",
    manifestHash: `sha256:${"a".repeat(64)}`,
    sceneGeneration: "g2d-generation-v1:1",
    playtestSessionId: "playtest-001",
  };
}

function message(
  instance: StudioFeasibilityBridge,
  sequence: number,
  command: "start" | "stop" | "cancel" | "submit-evidence" | "reconcile",
  payload: unknown,
  overrides: Record<string, unknown> = {},
) {
  const bytes = Buffer.from(JSON.stringify(payload));
  return createSignedBridgeMessage(instance.activation.secretHex, {
    protocolVersion: "1.0.0",
    sessionId: instance.activation.sessionId,
    sequence,
    requestId: `request-${sequence}`,
    expiresAtEpochMs: instance.activation.expiresAtEpochMs - 1,
    command,
    payloadBase64: bytes.toString("base64"),
    payloadDigest: hashStudioPayload(bytes),
    peerAddress: "127.0.0.1",
    origin: instance.activation.origin,
    ...overrides,
  });
}

function handshake(instance: StudioFeasibilityBridge) {
  const value = message(instance, 1, "reconcile", {
    binding: binding(instance),
    capabilityOffer: capabilityOffer(),
  });
  expect(instance.handle(value, "127.0.0.1", 1_001)).toMatchObject({
    ok: true,
  });
}

describe("development-only Studio feasibility bridge", () => {
  it("accepts a valid loopback handshake and exposes the exact binding", () => {
    const instance = bridge();
    handshake(instance);
    expect(instance.activation).toMatchObject({
      bridgeUrl: "http://127.0.0.1:4318",
      protocolVersion: "1.0.0",
      maximumPayloadBytes: 65_536,
    });
  });

  it("fails closed for negotiation and transport negatives", () => {
    for (const [offerOverride, expected] of [
      [{ protocolVersion: "2.0.0" }, "protocol-major-mismatch"],
      [{ securityFeatures: ["message-auth-v1"] }, "missing-integrity-feature"],
      [{ adapterId: "unapproved-adapter" }, "unapproved-adapter"],
    ] as const) {
      const instance = bridge();
      const value = message(instance, 1, "reconcile", {
        binding: binding(instance),
        capabilityOffer: capabilityOffer(offerOverride),
      });
      expect(instance.handle(value, "127.0.0.1", 1_001)).toMatchObject({
        ok: false,
        code: expected,
      });
    }
  });

  it("rejects replayed, expired, oversized, and non-loopback messages", () => {
    const instance = bridge();
    handshake(instance);
    const valid = message(instance, 2, "start", {});
    expect(instance.handle(valid, "127.0.0.1", 1_002)).toMatchObject({
      ok: true,
    });
    expect(instance.handle(valid, "127.0.0.1", 1_003)).toMatchObject({
      code: "replayed-sequence",
    });
    const expired = message(
      instance,
      3,
      "stop",
      {},
      { expiresAtEpochMs: 1_003 },
    );
    expect(instance.handle(expired, "127.0.0.1", 1_003)).toMatchObject({
      code: "expired-message",
    });
    const oversized = {
      ...message(instance, 3, "stop", {}),
      payloadBase64: Buffer.from("x".repeat(65_537)).toString("base64"),
    };
    expect(instance.handle(oversized, "127.0.0.1", 1_003)).toMatchObject({
      code: "malformed-loopback-request",
    });
    const local = message(instance, 3, "stop", {});
    expect(instance.handle(local, "192.168.1.2", 1_003)).toMatchObject({
      code: "malformed-loopback-request",
    });
  });

  it("rejects wrong scene, generation, stale, and interrupted evidence then exports bounded recovery", () => {
    const instance = bridge();
    handshake(instance);
    expect(
      instance.handle(message(instance, 2, "start", {}), "127.0.0.1", 1_002),
    ).toMatchObject({ ok: true });
    const current = binding(instance);
    const evidence = (overrides: Record<string, unknown> = {}) => {
      const payload = encoder.encode("observation");
      return {
        ...current,
        sequence: 1,
        payloadBase64: Buffer.from(payload).toString("base64"),
        payloadDigest: hashStudioPayload(payload),
        completionMarker: true,
        ...overrides,
      };
    };
    expect(
      instance.handle(
        message(
          instance,
          3,
          "submit-evidence",
          evidence({ sceneId: "place-1" }),
        ),
        "127.0.0.1",
        1_003,
      ),
    ).toMatchObject({ code: "wrong-scene" });
    expect(
      instance.handle(
        message(
          instance,
          4,
          "submit-evidence",
          evidence({ sceneGeneration: "generation-002" }),
        ),
        "127.0.0.1",
        1_004,
      ),
    ).toMatchObject({ code: "wrong-generation" });
    expect(
      instance.handle(
        message(instance, 5, "submit-evidence", evidence({ sequence: 2 })),
        "127.0.0.1",
        1_005,
      ),
    ).toMatchObject({ code: "replayed-evidence" });
    const recovery = instance.handle(
      message(instance, 6, "reconcile", { binding: current }),
      "127.0.0.1",
      1_006,
    );
    expect(recovery.ok).toBe(true);
    expect(typeof recovery.recoveryExport?.signature).toBe("string");
    expect(recovery.recoveryExport?.payload).not.toContain("secret");
  });
});
