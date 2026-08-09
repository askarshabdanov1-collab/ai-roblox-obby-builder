import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * A pure repository model for the Studio feasibility milestone. It performs no
 * I/O, opens no listener, and cannot execute Studio, Luau, shell, or filesystem
 * commands. A later, separately reviewed integration may use these guards.
 */

export const STUDIO_FEASIBILITY_PROTOCOL_VERSION = "1.0.0";
export const MULTIPLAYER_STATUS = "unsupported-unproven";
export const MAXIMUM_EVIDENCE_PAYLOAD_BYTES = 1024;
export const MAXIMUM_LOOPBACK_PAYLOAD_BYTES = 65_536;

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1"]);
const KNOWN_TRANSPORTS = new Set([
  "http-polling",
  "websocket-proxy",
  "signed-bundle-exchange",
  "mcp-studio-adapter",
]);
const APPROVED_MODEL_ADAPTERS = new Set([
  "studio-feasibility-model-v1",
  "manual-signed-bundle-v1",
]);
const REQUIRED_SECURITY_FEATURES = new Set([
  "loopback-only-v1",
  "message-auth-v1",
  "sequence-v1",
  "expiry-v1",
  "payload-digest-v1",
  "integrity-v1",
]);
const KNOWN_PLAYTEST_MODES = new Set(["single-player"]);
const KNOWN_CAPTURE_CAPABILITIES = new Set(["none"]);
const KNOWN_COMMANDS = new Set([
  "start",
  "stop",
  "cancel",
  "submit-evidence",
  "reconcile",
]);
const secretBySession = new WeakMap<object, Uint8Array>();

export type StudioBinding = Readonly<{
  executionId: string;
  sceneId: string;
  generatedRootOwner: string;
  manifestHash: `sha256:${string}`;
  sceneGeneration: string;
  playtestSessionId: string;
}>;

export type CapabilityOffer = Readonly<{
  protocolVersion: string;
  studioVersion: string;
  windowsVersion: string;
  pluginVersion: string;
  bridgeVersion: string;
  orchestratorVersion: string;
  adapterId: string;
  transports: readonly string[];
  playtestModes: readonly string[];
  captureCapabilities: readonly string[];
  securityFeatures: readonly string[];
  maximumPayloadBytes: number;
}>;

export type CapabilityNegotiationResult =
  | Readonly<{
      ok: true;
      selectedTransport: string;
      maximumPayloadBytes: number;
      multiplayerStatus: typeof MULTIPLAYER_STATUS;
    }>
  | Readonly<{ ok: false; code: string }>;

export type LoopbackCommand =
  "start" | "stop" | "cancel" | "submit-evidence" | "reconcile";

export type LoopbackSession = Readonly<{
  sessionId: string;
  peerAddress: "127.0.0.1" | "::1";
  expectedOrigin: string;
  expiresAtEpochMs: number;
  maximumPayloadBytes: number;
  allowedCommands: readonly LoopbackCommand[];
  nextSequence: number;
}>;

export type LoopbackControlLease = Readonly<{
  activeSessionId: string | undefined;
}>;

type UnsignedLoopbackMessage = Readonly<{
  protocolVersion: string;
  sessionId: string;
  sequence: number;
  requestId: string;
  expiresAtEpochMs: number;
  command: LoopbackCommand;
  payload: Uint8Array;
  payloadDigest: `sha256:${string}`;
  peerAddress: string;
  origin: string;
}>;

export type AuthenticatedLoopbackMessage = UnsignedLoopbackMessage &
  Readonly<{ authenticationTag: string }>;

export type AuthenticatedMessageResult =
  | Readonly<{ ok: true; nextSequence: number }>
  | Readonly<{ ok: false; code: string }>;

export type StudioLifecycleStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "running"
  | "stopping"
  | "completed"
  | "cancelling"
  | "cancelled"
  | "cleanup-uncertain"
  | "reconciliation-required"
  | "reconciled"
  | "manual-recovery-required";

export type StudioLifecycle = Readonly<{
  status: StudioLifecycleStatus;
  binding: StudioBinding;
  nextEvidenceSequence: number;
  automationLocked: boolean;
  lastTransitionEpochMs: number;
}>;

export type LifecycleEvent =
  | Readonly<{ kind: "begin"; nowEpochMs: number }>
  | Readonly<{
      kind: "confirm-scene";
      binding: StudioBinding;
      nowEpochMs: number;
    }>
  | Readonly<{ kind: "start-playtest"; nowEpochMs: number }>
  | Readonly<{ kind: "stop"; nowEpochMs: number }>
  | Readonly<{ kind: "cancel"; nowEpochMs: number }>
  | Readonly<{ kind: "cleanup-complete"; nowEpochMs: number }>
  | Readonly<{ kind: "timeout"; nowEpochMs: number }>
  | Readonly<{ kind: "lease-expired"; nowEpochMs: number }>
  | Readonly<{ kind: "interrupted"; nowEpochMs: number }>
  | Readonly<{
      kind: "reconcile";
      binding: StudioBinding;
      cleanupState: "owned-cleaned" | "uncertain";
      nowEpochMs: number;
    }>
  | Readonly<{
      kind: "manual-recovery-complete";
      confirmedByUser: boolean;
      nowEpochMs: number;
    }>;

export type LifecycleTransitionResult = Readonly<{
  lifecycle: StudioLifecycle;
  result: Readonly<{ ok: true }> | Readonly<{ ok: false; code: string }>;
}>;

export type StudioEvidenceEnvelope = StudioBinding &
  Readonly<{
    sequence: number;
    payload: Uint8Array;
    payloadDigest: `sha256:${string}`;
    completionMarker: boolean;
  }>;

export type StudioEvidenceResult = Readonly<{
  lifecycle: StudioLifecycle;
  result:
    | Readonly<{ ok: true; nextSequence: number }>
    | Readonly<{ ok: false; code: string }>;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string") &&
    new Set(value).size === value.length
  );
}

function isSafePositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{2,63}$/.test(value);
}

function isGenerationToken(value: unknown): value is string {
  return (
    isIdentifier(value) ||
    (typeof value === "string" && /^g2d-generation-v1:[1-9][0-9]*$/.test(value))
  );
}

function isSha256(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function parseMajor(version: unknown): number | undefined {
  if (typeof version !== "string") return undefined;
  const match = /^([0-9]+)\.[0-9]+\.[0-9]+$/.exec(version);
  if (match === null) return undefined;
  const major = Number(match[1]);
  return Number.isSafeInteger(major) ? major : undefined;
}

function isLoopbackAddress(value: unknown): value is "127.0.0.1" | "::1" {
  return typeof value === "string" && LOOPBACK_ADDRESSES.has(value);
}

function sameBinding(left: StudioBinding, right: StudioBinding): boolean {
  return (
    left.executionId === right.executionId &&
    left.sceneId === right.sceneId &&
    left.generatedRootOwner === right.generatedRootOwner &&
    left.manifestHash === right.manifestHash &&
    left.sceneGeneration === right.sceneGeneration &&
    left.playtestSessionId === right.playtestSessionId
  );
}

function validBinding(value: unknown): value is StudioBinding {
  if (!isRecord(value)) return false;
  return (
    isIdentifier(value.executionId) &&
    isIdentifier(value.sceneId) &&
    typeof value.generatedRootOwner === "string" &&
    /^AIObbyBuilder\/[0-9]+\.[0-9]+$/.test(value.generatedRootOwner) &&
    isSha256(value.manifestHash) &&
    isGenerationToken(value.sceneGeneration) &&
    isIdentifier(value.playtestSessionId)
  );
}

function cloneLifecycle(
  lifecycle: StudioLifecycle,
  status: StudioLifecycleStatus,
  nowEpochMs: number,
  automationLocked = lifecycle.automationLocked,
): StudioLifecycle {
  return Object.freeze({
    ...lifecycle,
    status,
    automationLocked,
    lastTransitionEpochMs: nowEpochMs,
  });
}

function rejectedSession(session: LoopbackSession, code: string) {
  return {
    session,
    result: Object.freeze({ ok: false as const, code }),
  };
}

function capabilitySet(offer: CapabilityOffer): Set<string> {
  return new Set([
    ...offer.transports,
    ...offer.playtestModes,
    ...offer.captureCapabilities,
    ...offer.securityFeatures,
  ]);
}

function validCapabilityOffer(value: unknown): value is CapabilityOffer {
  if (!isRecord(value)) return false;
  return (
    typeof value.protocolVersion === "string" &&
    typeof value.studioVersion === "string" &&
    typeof value.windowsVersion === "string" &&
    typeof value.pluginVersion === "string" &&
    typeof value.bridgeVersion === "string" &&
    typeof value.orchestratorVersion === "string" &&
    typeof value.adapterId === "string" &&
    isStringArray(value.transports) &&
    isStringArray(value.playtestModes) &&
    isStringArray(value.captureCapabilities) &&
    isStringArray(value.securityFeatures) &&
    isSafePositiveInteger(value.maximumPayloadBytes) &&
    value.maximumPayloadBytes <= MAXIMUM_LOOPBACK_PAYLOAD_BYTES &&
    value.transports.every((transport) => KNOWN_TRANSPORTS.has(transport)) &&
    value.playtestModes.every((mode) => KNOWN_PLAYTEST_MODES.has(mode)) &&
    value.captureCapabilities.every((capability) =>
      KNOWN_CAPTURE_CAPABILITIES.has(capability),
    ) &&
    value.securityFeatures.every((feature) =>
      REQUIRED_SECURITY_FEATURES.has(feature),
    )
  );
}

export function negotiateStudioCapabilities(
  input: unknown,
): CapabilityNegotiationResult {
  if (!isRecord(input) || !isStringArray(input.requiredCapabilities)) {
    return Object.freeze({ ok: false, code: "malformed-negotiation" });
  }
  const local = input.local;
  const peer = input.peer;
  if (!validCapabilityOffer(local) || !validCapabilityOffer(peer)) {
    return Object.freeze({ ok: false, code: "malformed-capability-offer" });
  }
  if (
    !APPROVED_MODEL_ADAPTERS.has(local.adapterId) ||
    !APPROVED_MODEL_ADAPTERS.has(peer.adapterId)
  ) {
    return Object.freeze({ ok: false, code: "unapproved-adapter" });
  }
  const localMajor = parseMajor(local.protocolVersion);
  const peerMajor = parseMajor(peer.protocolVersion);
  const expectedMajor = parseMajor(STUDIO_FEASIBILITY_PROTOCOL_VERSION);
  if (
    localMajor === undefined ||
    peerMajor === undefined ||
    expectedMajor === undefined ||
    localMajor !== expectedMajor ||
    peerMajor !== expectedMajor
  ) {
    return Object.freeze({ ok: false, code: "protocol-major-mismatch" });
  }
  const localCapabilities = capabilitySet(local);
  const peerCapabilities = capabilitySet(peer);
  for (const required of REQUIRED_SECURITY_FEATURES) {
    if (!localCapabilities.has(required) || !peerCapabilities.has(required)) {
      return Object.freeze({ ok: false, code: "missing-integrity-feature" });
    }
  }
  for (const required of input.requiredCapabilities) {
    if (!localCapabilities.has(required) || !peerCapabilities.has(required)) {
      return Object.freeze({
        ok: false,
        code: "required-capability-unavailable",
      });
    }
  }
  if (typeof input.selectedTransport !== "string") {
    return Object.freeze({ ok: false, code: "malformed-negotiation" });
  }
  if (!KNOWN_TRANSPORTS.has(input.selectedTransport)) {
    return Object.freeze({ ok: false, code: "unsupported-transport" });
  }
  if (
    !local.transports.includes(input.selectedTransport) ||
    !peer.transports.includes(input.selectedTransport)
  ) {
    return Object.freeze({ ok: false, code: "transport-unavailable" });
  }
  return Object.freeze({
    ok: true,
    selectedTransport: input.selectedTransport,
    maximumPayloadBytes: Math.min(
      local.maximumPayloadBytes,
      peer.maximumPayloadBytes,
    ),
    multiplayerStatus: MULTIPLAYER_STATUS,
  });
}

export function hashStudioPayload(payload: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

export function createEphemeralSessionSecret(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

function messagePreimage(message: UnsignedLoopbackMessage): string {
  return [
    message.protocolVersion,
    message.sessionId,
    String(message.sequence),
    message.requestId,
    String(message.expiresAtEpochMs),
    message.command,
    message.payloadDigest,
    message.peerAddress,
    message.origin,
  ].join("\n");
}

export function signLoopbackMessage(
  secret: Uint8Array,
  message: UnsignedLoopbackMessage,
): string {
  return createHmac("sha256", secret)
    .update(messagePreimage(message), "utf8")
    .digest("base64url");
}

export function createLoopbackSession(
  input: Readonly<{
    sessionId: string;
    secret: Uint8Array;
    peerAddress: "127.0.0.1" | "::1";
    expectedOrigin: string;
    expiresAtEpochMs: number;
    maximumPayloadBytes: number;
    allowedCommands: readonly LoopbackCommand[];
  }>,
): LoopbackSession {
  if (
    !isIdentifier(input.sessionId) ||
    !isLoopbackAddress(input.peerAddress) ||
    typeof input.expectedOrigin !== "string" ||
    input.expectedOrigin.length === 0 ||
    !isSafePositiveInteger(input.expiresAtEpochMs) ||
    !isSafePositiveInteger(input.maximumPayloadBytes) ||
    input.maximumPayloadBytes > MAXIMUM_LOOPBACK_PAYLOAD_BYTES ||
    input.secret.byteLength < 16 ||
    !isStringArray(input.allowedCommands) ||
    !input.allowedCommands.every((command) => KNOWN_COMMANDS.has(command))
  ) {
    throw new TypeError("invalid loopback feasibility session");
  }
  const session = Object.freeze({
    sessionId: input.sessionId,
    peerAddress: input.peerAddress,
    expectedOrigin: input.expectedOrigin,
    expiresAtEpochMs: input.expiresAtEpochMs,
    maximumPayloadBytes: input.maximumPayloadBytes,
    allowedCommands: Object.freeze([...input.allowedCommands]),
    nextSequence: 1,
  });
  secretBySession.set(session, new Uint8Array(input.secret));
  return session;
}

export function createLoopbackControlLease(): LoopbackControlLease {
  return Object.freeze({ activeSessionId: undefined });
}

export function claimLoopbackControl(
  lease: LoopbackControlLease,
  sessionId: string,
): Readonly<{
  lease: LoopbackControlLease;
  result: Readonly<{ ok: true }> | Readonly<{ ok: false; code: string }>;
}> {
  if (!isIdentifier(sessionId)) {
    return Object.freeze({
      lease,
      result: Object.freeze({ ok: false, code: "invalid-session" }),
    });
  }
  if (
    lease.activeSessionId !== undefined &&
    lease.activeSessionId !== sessionId
  ) {
    return Object.freeze({
      lease,
      result: Object.freeze({ ok: false, code: "control-session-active" }),
    });
  }
  return Object.freeze({
    lease: Object.freeze({ activeSessionId: sessionId }),
    result: Object.freeze({ ok: true }),
  });
}

export function releaseLoopbackControl(
  lease: LoopbackControlLease,
  sessionId: string,
): Readonly<{
  lease: LoopbackControlLease;
  result: Readonly<{ ok: true }> | Readonly<{ ok: false; code: string }>;
}> {
  if (lease.activeSessionId !== sessionId) {
    return Object.freeze({
      lease,
      result: Object.freeze({ ok: false, code: "control-session-mismatch" }),
    });
  }
  return Object.freeze({
    lease: Object.freeze({ activeSessionId: undefined }),
    result: Object.freeze({ ok: true }),
  });
}

function validLoopbackMessage(
  value: unknown,
): value is AuthenticatedLoopbackMessage {
  if (!isRecord(value)) return false;
  return (
    typeof value.protocolVersion === "string" &&
    isIdentifier(value.sessionId) &&
    isSafePositiveInteger(value.sequence) &&
    isIdentifier(value.requestId) &&
    isSafePositiveInteger(value.expiresAtEpochMs) &&
    typeof value.command === "string" &&
    KNOWN_COMMANDS.has(value.command) &&
    value.payload instanceof Uint8Array &&
    isSha256(value.payloadDigest) &&
    typeof value.peerAddress === "string" &&
    typeof value.origin === "string" &&
    typeof value.authenticationTag === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(value.authenticationTag)
  );
}

function validStudioEvidenceEnvelope(
  value: unknown,
): value is StudioEvidenceEnvelope {
  if (!isRecord(value)) return false;
  return (
    isIdentifier(value.executionId) &&
    isIdentifier(value.sceneId) &&
    typeof value.generatedRootOwner === "string" &&
    /^AIObbyBuilder\/[0-9]+\.[0-9]+$/.test(value.generatedRootOwner) &&
    isSha256(value.manifestHash) &&
    isGenerationToken(value.sceneGeneration) &&
    isIdentifier(value.playtestSessionId) &&
    isSafePositiveInteger(value.sequence) &&
    value.payload instanceof Uint8Array &&
    isSha256(value.payloadDigest) &&
    typeof value.completionMarker === "boolean"
  );
}

function nextSession(session: LoopbackSession): LoopbackSession | undefined {
  const secret = secretBySession.get(session);
  if (secret === undefined) return undefined;
  const next = Object.freeze({
    ...session,
    nextSequence: session.nextSequence + 1,
  });
  secretBySession.set(next, secret);
  return next;
}

export function acceptAuthenticatedMessage(
  session: LoopbackSession,
  message: unknown,
  nowEpochMs: number,
): Readonly<{ session: LoopbackSession; result: AuthenticatedMessageResult }> {
  if (!isSafePositiveInteger(nowEpochMs)) {
    return rejectedSession(session, "invalid-clock");
  }
  if (nowEpochMs >= session.expiresAtEpochMs) {
    return rejectedSession(session, "expired-session");
  }
  if (!validLoopbackMessage(message)) {
    return rejectedSession(session, "malformed-message");
  }
  if (
    !isLoopbackAddress(message.peerAddress) ||
    message.peerAddress !== session.peerAddress
  ) {
    return rejectedSession(session, "non-loopback-peer");
  }
  if (message.origin !== session.expectedOrigin) {
    return rejectedSession(session, "unexpected-origin");
  }
  if (
    parseMajor(message.protocolVersion) !==
    parseMajor(STUDIO_FEASIBILITY_PROTOCOL_VERSION)
  ) {
    return rejectedSession(session, "protocol-major-mismatch");
  }
  if (message.sessionId !== session.sessionId) {
    return rejectedSession(session, "wrong-session");
  }
  if (
    message.expiresAtEpochMs <= nowEpochMs ||
    message.expiresAtEpochMs > session.expiresAtEpochMs
  ) {
    return rejectedSession(session, "expired-message");
  }
  if (message.sequence !== session.nextSequence) {
    return rejectedSession(session, "replayed-sequence");
  }
  if (!session.allowedCommands.includes(message.command)) {
    return rejectedSession(session, "command-not-allowed");
  }
  if (message.payload.byteLength > session.maximumPayloadBytes) {
    return rejectedSession(session, "payload-too-large");
  }
  if (hashStudioPayload(message.payload) !== message.payloadDigest) {
    return rejectedSession(session, "payload-digest-mismatch");
  }
  const secret = secretBySession.get(session);
  if (secret === undefined)
    return rejectedSession(session, "invalid-session-state");
  const expectedTag = signLoopbackMessage(secret, message);
  const received = Buffer.from(message.authenticationTag, "utf8");
  const expected = Buffer.from(expectedTag, "utf8");
  if (
    received.byteLength !== expected.byteLength ||
    !timingSafeEqual(received, expected)
  ) {
    return rejectedSession(session, "authentication-failed");
  }
  const next = nextSession(session);
  if (next === undefined)
    return rejectedSession(session, "invalid-session-state");
  return Object.freeze({
    session: next,
    result: Object.freeze({ ok: true, nextSequence: next.nextSequence }),
  });
}

export function createStudioLifecycle(binding: StudioBinding): StudioLifecycle {
  if (!validBinding(binding)) throw new TypeError("invalid Studio binding");
  return Object.freeze({
    status: "idle",
    binding: Object.freeze({ ...binding }),
    nextEvidenceSequence: 1,
    automationLocked: false,
    lastTransitionEpochMs: 0,
  });
}

function rejectedLifecycle(
  lifecycle: StudioLifecycle,
  code: string,
): LifecycleTransitionResult {
  return Object.freeze({
    lifecycle,
    result: Object.freeze({ ok: false, code }),
  });
}

function acceptedLifecycle(
  lifecycle: StudioLifecycle,
): LifecycleTransitionResult {
  return Object.freeze({ lifecycle, result: Object.freeze({ ok: true }) });
}

export function advanceStudioLifecycle(
  lifecycle: StudioLifecycle,
  event: LifecycleEvent,
): LifecycleTransitionResult {
  if (!isSafePositiveInteger(event.nowEpochMs)) {
    return rejectedLifecycle(lifecycle, "invalid-clock");
  }
  if (event.nowEpochMs < lifecycle.lastTransitionEpochMs) {
    return rejectedLifecycle(lifecycle, "non-monotonic-transition-time");
  }
  switch (event.kind) {
    case "begin":
      if (lifecycle.status !== "idle" && lifecycle.status !== "reconciled") {
        return rejectedLifecycle(lifecycle, "invalid-transition");
      }
      return acceptedLifecycle(
        cloneLifecycle(lifecycle, "preparing", event.nowEpochMs, false),
      );
    case "confirm-scene":
      if (lifecycle.status !== "preparing") {
        return rejectedLifecycle(lifecycle, "invalid-transition");
      }
      if (
        !validBinding(event.binding) ||
        !sameBinding(lifecycle.binding, event.binding)
      ) {
        return rejectedLifecycle(lifecycle, "wrong-scene");
      }
      return acceptedLifecycle(
        cloneLifecycle(lifecycle, "ready", event.nowEpochMs),
      );
    case "start-playtest":
      if (lifecycle.status !== "ready" || lifecycle.automationLocked) {
        return rejectedLifecycle(lifecycle, "invalid-transition");
      }
      return acceptedLifecycle(
        cloneLifecycle(lifecycle, "running", event.nowEpochMs),
      );
    case "stop":
      if (
        lifecycle.status === "stopping" ||
        lifecycle.status === "completed" ||
        lifecycle.status === "cancelled"
      ) {
        return acceptedLifecycle(lifecycle);
      }
      if (lifecycle.status !== "ready" && lifecycle.status !== "running") {
        return rejectedLifecycle(lifecycle, "invalid-transition");
      }
      return acceptedLifecycle(
        cloneLifecycle(lifecycle, "stopping", event.nowEpochMs),
      );
    case "cancel":
      if (
        lifecycle.status === "cancelling" ||
        lifecycle.status === "cancelled"
      ) {
        return acceptedLifecycle(lifecycle);
      }
      if (
        !["preparing", "ready", "running", "stopping"].includes(
          lifecycle.status,
        )
      ) {
        return rejectedLifecycle(lifecycle, "invalid-transition");
      }
      return acceptedLifecycle(
        cloneLifecycle(lifecycle, "cancelling", event.nowEpochMs),
      );
    case "cleanup-complete":
      if (lifecycle.status === "stopping") {
        return acceptedLifecycle(
          cloneLifecycle(lifecycle, "completed", event.nowEpochMs),
        );
      }
      if (lifecycle.status === "cancelling") {
        return acceptedLifecycle(
          cloneLifecycle(lifecycle, "cancelled", event.nowEpochMs),
        );
      }
      return rejectedLifecycle(lifecycle, "invalid-transition");
    case "timeout":
    case "lease-expired":
      if (
        !["preparing", "ready", "running", "stopping", "cancelling"].includes(
          lifecycle.status,
        )
      ) {
        return rejectedLifecycle(lifecycle, "invalid-transition");
      }
      return acceptedLifecycle(
        cloneLifecycle(lifecycle, "cleanup-uncertain", event.nowEpochMs, true),
      );
    case "interrupted":
      if (
        !["preparing", "ready", "running", "stopping", "cancelling"].includes(
          lifecycle.status,
        )
      ) {
        return rejectedLifecycle(lifecycle, "invalid-transition");
      }
      return acceptedLifecycle(
        cloneLifecycle(
          lifecycle,
          "reconciliation-required",
          event.nowEpochMs,
          true,
        ),
      );
    case "reconcile":
      if (lifecycle.status !== "reconciliation-required") {
        return rejectedLifecycle(lifecycle, "invalid-transition");
      }
      if (
        !validBinding(event.binding) ||
        !sameBinding(lifecycle.binding, event.binding) ||
        event.cleanupState === "uncertain"
      ) {
        return acceptedLifecycle(
          cloneLifecycle(
            lifecycle,
            "manual-recovery-required",
            event.nowEpochMs,
            true,
          ),
        );
      }
      return acceptedLifecycle(
        cloneLifecycle(lifecycle, "reconciled", event.nowEpochMs, false),
      );
    case "manual-recovery-complete":
      if (
        lifecycle.status !== "manual-recovery-required" ||
        !event.confirmedByUser
      ) {
        return rejectedLifecycle(lifecycle, "manual-recovery-required");
      }
      return acceptedLifecycle(
        cloneLifecycle(lifecycle, "reconciled", event.nowEpochMs, false),
      );
    default:
      return rejectedLifecycle(lifecycle, "unknown-lifecycle-event");
  }
}

function rejectedEvidence(
  lifecycle: StudioLifecycle,
  code: string,
): StudioEvidenceResult {
  return Object.freeze({
    lifecycle,
    result: Object.freeze({ ok: false, code }),
  });
}

export function acceptStudioEvidence(
  lifecycle: StudioLifecycle,
  evidence: unknown,
): StudioEvidenceResult {
  if (lifecycle.status !== "running" || lifecycle.automationLocked) {
    return rejectedEvidence(lifecycle, "interrupted-evidence");
  }
  if (!validStudioEvidenceEnvelope(evidence)) {
    return rejectedEvidence(lifecycle, "malformed-evidence");
  }
  if (
    evidence.executionId !== lifecycle.binding.executionId ||
    evidence.sceneId !== lifecycle.binding.sceneId ||
    evidence.generatedRootOwner !== lifecycle.binding.generatedRootOwner ||
    evidence.manifestHash !== lifecycle.binding.manifestHash ||
    evidence.playtestSessionId !== lifecycle.binding.playtestSessionId
  ) {
    return rejectedEvidence(lifecycle, "wrong-scene");
  }
  if (evidence.sceneGeneration !== lifecycle.binding.sceneGeneration) {
    return rejectedEvidence(lifecycle, "wrong-generation");
  }
  if (evidence.sequence !== lifecycle.nextEvidenceSequence) {
    return rejectedEvidence(lifecycle, "replayed-evidence");
  }
  if (evidence.payload.byteLength > MAXIMUM_EVIDENCE_PAYLOAD_BYTES) {
    return rejectedEvidence(lifecycle, "evidence-too-large");
  }
  if (hashStudioPayload(evidence.payload) !== evidence.payloadDigest) {
    return rejectedEvidence(lifecycle, "evidence-digest-mismatch");
  }
  if (!evidence.completionMarker) {
    return rejectedEvidence(lifecycle, "incomplete-evidence");
  }
  const next = Object.freeze({
    ...lifecycle,
    nextEvidenceSequence: lifecycle.nextEvidenceSequence + 1,
  });
  return Object.freeze({
    lifecycle: next,
    result: Object.freeze({
      ok: true,
      nextSequence: next.nextEvidenceSequence,
    }),
  });
}
