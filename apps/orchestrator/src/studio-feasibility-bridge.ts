import { createHmac, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";

import {
  acceptAuthenticatedMessage,
  acceptStudioEvidence,
  advanceStudioLifecycle,
  createLoopbackControlLease,
  createLoopbackSession,
  createStudioLifecycle,
  hashStudioPayload,
  negotiateStudioCapabilities,
  type AuthenticatedLoopbackMessage,
  type LoopbackControlLease,
  type LoopbackSession,
  type StudioBinding,
  type StudioLifecycle,
} from "./studio-feasibility.js";

const ORIGIN = "roblox-studio-plugin://ai-obby-builder-studio-feasibility";
const ADAPTER = "studio-feasibility-model-v1";
const MAX_BYTES = 65_536;
const COMMANDS = new Set([
  "start",
  "stop",
  "cancel",
  "submit-evidence",
  "reconcile",
]);

type WireMessage = Omit<AuthenticatedLoopbackMessage, "payload"> & {
  payloadBase64: string;
};

export type BridgeActivation = Readonly<{
  protocolVersion: "1.0.0";
  bridgeUrl: string;
  sessionId: string;
  executionId: string;
  secretHex: string;
  expiresAtEpochMs: number;
  maximumPayloadBytes: number;
  origin: typeof ORIGIN;
}>;

export type BridgeResult = Readonly<{
  ok: boolean;
  code?: string;
  binding?: StudioBinding;
  recoveryExport?: Readonly<{ payload: string; signature: string }>;
}>;

function identifier(prefix: string): string {
  return `${prefix}-${randomBytes(12).toString("hex")}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function decodePayload(value: unknown): Uint8Array | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    return undefined;
  const decoded = Buffer.from(value, "base64");
  return decoded.byteLength <= MAX_BYTES ? new Uint8Array(decoded) : undefined;
}

function normalizePeer(value: string | undefined): "127.0.0.1" | undefined {
  return value === "127.0.0.1" || value === "::ffff:127.0.0.1"
    ? "127.0.0.1"
    : undefined;
}

function parseBinding(value: unknown): StudioBinding | undefined {
  const record = asRecord(value);
  if (
    record === undefined ||
    typeof record.executionId !== "string" ||
    typeof record.sceneId !== "string" ||
    typeof record.generatedRootOwner !== "string" ||
    typeof record.manifestHash !== "string" ||
    typeof record.sceneGeneration !== "string" ||
    typeof record.playtestSessionId !== "string"
  )
    return undefined;
  return record as unknown as StudioBinding;
}

function offer(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: "1.0.0",
    studioVersion: "development-only",
    windowsVersion: "development-only",
    pluginVersion: "0.1.0-dev",
    bridgeVersion: "0.1.0-dev",
    orchestratorVersion: "0.2.0",
    adapterId: ADAPTER,
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
    maximumPayloadBytes: MAX_BYTES,
    ...overrides,
  };
}

export class StudioFeasibilityBridge {
  readonly activation: BridgeActivation;
  #secret: Uint8Array;
  #session: LoopbackSession;
  #lease: LoopbackControlLease = createLoopbackControlLease();
  #lifecycle: StudioLifecycle | undefined;

  constructor(port: number, nowEpochMs = Date.now(), ttlMs = 10 * 60_000) {
    if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
      throw new TypeError("invalid bridge port");
    this.#secret = new Uint8Array(randomBytes(32));
    const sessionId = identifier("studio-session");
    const executionId = identifier("execution");
    const expiresAtEpochMs = nowEpochMs + ttlMs;
    this.#session = createLoopbackSession({
      sessionId,
      secret: this.#secret,
      peerAddress: "127.0.0.1",
      expectedOrigin: ORIGIN,
      expiresAtEpochMs,
      maximumPayloadBytes: MAX_BYTES,
      allowedCommands: [
        "start",
        "stop",
        "cancel",
        "submit-evidence",
        "reconcile",
      ],
    });
    this.activation = Object.freeze({
      protocolVersion: "1.0.0",
      bridgeUrl: `http://127.0.0.1:${port}`,
      sessionId,
      executionId,
      secretHex: Buffer.from(this.#secret).toString("hex"),
      expiresAtEpochMs,
      maximumPayloadBytes: MAX_BYTES,
      origin: ORIGIN,
    });
  }

  handle(
    value: unknown,
    remoteAddress: string | undefined,
    nowEpochMs = Date.now(),
  ): BridgeResult {
    const record = asRecord(value);
    const peerAddress = normalizePeer(remoteAddress);
    const payload =
      record === undefined ? undefined : decodePayload(record.payloadBase64);
    if (
      record === undefined ||
      payload === undefined ||
      peerAddress === undefined
    )
      return { ok: false, code: "malformed-loopback-request" };
    const message = {
      ...record,
      payload,
    } as unknown as AuthenticatedLoopbackMessage;
    if (message.peerAddress !== peerAddress || message.origin !== ORIGIN)
      return { ok: false, code: "non-loopback-peer" };
    const accepted = acceptAuthenticatedMessage(
      this.#session,
      message,
      nowEpochMs,
    );
    this.#session = accepted.session;
    if (!accepted.result.ok) return accepted.result;
    if (!COMMANDS.has(message.command))
      return { ok: false, code: "command-not-allowed" };
    const decoded = (() => {
      try {
        return JSON.parse(Buffer.from(payload).toString("utf8")) as unknown;
      } catch {
        return undefined;
      }
    })();
    if (decoded === undefined)
      return { ok: false, code: "malformed-command-payload" };
    if (message.command === "reconcile" && this.#lifecycle === undefined) {
      return this.#handshake(decoded, nowEpochMs);
    }
    if (this.#lifecycle === undefined)
      return { ok: false, code: "handshake-required" };
    return this.#command(message.command, decoded, nowEpochMs);
  }

  #handshake(payload: unknown, nowEpochMs: number): BridgeResult {
    const record = asRecord(payload);
    const binding =
      record === undefined ? undefined : parseBinding(record.binding);
    const peerOffer = record?.capabilityOffer;
    const negotiation = negotiateStudioCapabilities({
      local: offer(),
      peer: peerOffer,
      requiredCapabilities: ["single-player", "integrity-v1"],
      selectedTransport: "http-polling",
    });
    if (!negotiation.ok) return negotiation;
    if (binding?.executionId !== this.activation.executionId)
      return { ok: false, code: "wrong-execution" };
    try {
      this.#lifecycle = advanceStudioLifecycle(createStudioLifecycle(binding), {
        kind: "begin",
        nowEpochMs,
      }).lifecycle;
      const scene = advanceStudioLifecycle(this.#lifecycle, {
        kind: "confirm-scene",
        binding,
        nowEpochMs: nowEpochMs + 1,
      });
      if (!scene.result.ok) return scene.result;
      this.#lifecycle = scene.lifecycle;
      const claimed =
        this.#lease.activeSessionId === undefined
          ? {
              lease: Object.freeze({
                activeSessionId: this.activation.sessionId,
              }),
              result: { ok: true as const },
            }
          : {
              lease: this.#lease,
              result: { ok: false as const, code: "control-session-active" },
            };
      if (!claimed.result.ok) return claimed.result;
      this.#lease = claimed.lease;
      return { ok: true, binding };
    } catch {
      return { ok: false, code: "invalid-binding" };
    }
  }

  #command(
    command: string,
    payload: unknown,
    nowEpochMs: number,
  ): BridgeResult {
    const lifecycle = this.#lifecycle;
    if (lifecycle === undefined)
      return { ok: false, code: "handshake-required" };
    if (command === "submit-evidence") {
      const record = asRecord(payload);
      if (record === undefined)
        return { ok: false, code: "malformed-evidence" };
      const bytes = decodePayload(record.payloadBase64);
      const evidence =
        bytes === undefined ? undefined : { ...record, payload: bytes };
      const accepted = acceptStudioEvidence(lifecycle, evidence);
      this.#lifecycle = accepted.lifecycle;
      return accepted.result;
    }
    const event =
      command === "start"
        ? "start-playtest"
        : command === "stop"
          ? "stop"
          : command === "cancel"
            ? "cancel"
            : "reconcile";
    if (event === "reconcile") {
      const record = asRecord(payload);
      const binding =
        record === undefined ? undefined : parseBinding(record.binding);
      const interrupted = advanceStudioLifecycle(lifecycle, {
        kind: "interrupted",
        nowEpochMs,
      });
      this.#lifecycle = interrupted.lifecycle;
      if (!interrupted.result.ok || binding === undefined)
        return { ok: false, code: "manual-recovery-required" };
      const reconciled = advanceStudioLifecycle(this.#lifecycle, {
        kind: "reconcile",
        binding,
        cleanupState: "owned-cleaned",
        nowEpochMs: nowEpochMs + 1,
      });
      this.#lifecycle = reconciled.lifecycle;
      if (!reconciled.result.ok) return reconciled.result;
      const recovery = JSON.stringify({
        schemaVersion: "studio-feasibility-recovery-v1",
        status: "reconciled",
        binding,
      });
      return {
        ok: true,
        binding,
        recoveryExport: {
          payload: recovery,
          signature: createHmac("sha256", this.#secret)
            .update(recovery)
            .digest("base64url"),
        },
      };
    }
    const transitioned = advanceStudioLifecycle(lifecycle, {
      kind: event,
      nowEpochMs,
    } as never);
    this.#lifecycle = transitioned.lifecycle;
    if (command === "stop" && transitioned.result.ok) {
      this.#lifecycle = advanceStudioLifecycle(this.#lifecycle, {
        kind: "cleanup-complete",
        nowEpochMs: nowEpochMs + 1,
      }).lifecycle;
    }
    return transitioned.result;
  }
}

export function createStudioFeasibilityBridgeServer(port: number): {
  bridge: StudioFeasibilityBridge;
  server: Server;
} {
  const bridge = new StudioFeasibilityBridge(port);
  const server = createServer((request, response) => {
    if (
      request.method !== "POST" ||
      request.url !== "/v1/message" ||
      normalizePeer(request.socket.remoteAddress) === undefined
    ) {
      response.writeHead(404).end();
      return;
    }
    let body = Buffer.alloc(0);
    request.on("data", (chunk: Buffer) => {
      body = Buffer.concat([body, chunk]);
      if (body.byteLength > MAX_BYTES) request.destroy();
    });
    request.on("end", () => {
      let result: BridgeResult;
      try {
        result = bridge.handle(
          JSON.parse(body.toString("utf8")),
          request.socket.remoteAddress,
        );
      } catch {
        result = { ok: false, code: "malformed-json" };
      }
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.setHeader("x-content-type-options", "nosniff");
      response.writeHead(result.ok ? 200 : 400).end(JSON.stringify(result));
    });
  });
  return { bridge, server };
}

export function createSignedBridgeMessage(
  secretHex: string,
  message: Omit<WireMessage, "authenticationTag">,
): WireMessage {
  const secret = Buffer.from(secretHex, "hex");
  const payload = decodePayload(message.payloadBase64);
  if (secret.byteLength !== 32 || payload === undefined)
    throw new TypeError("invalid bridge message");
  const digest = hashStudioPayload(payload);
  const preimage = [
    message.protocolVersion,
    message.sessionId,
    String(message.sequence),
    message.requestId,
    String(message.expiresAtEpochMs),
    message.command,
    digest,
    message.peerAddress,
    message.origin,
  ].join("\n");
  return {
    ...message,
    payloadDigest: digest,
    authenticationTag: createHmac("sha256", secret)
      .update(preimage)
      .digest("base64url"),
  };
}
