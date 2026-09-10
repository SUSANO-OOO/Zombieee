import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const WEBKIT_HOST_RESOURCE_TELEMETRY_SCHEMA = "v100-webkit-host-resource-telemetry/v1";
export const WEBKIT_HOST_RESOURCE_TELEMETRY_INTERVAL_MS = 500;
export const WEBKIT_WAIT_OWNER_SCHEMA = "v100-webkit-wait-owner/v1";
export const WEBKIT_WAIT_OWNER_DETAIL_LIMIT = 64;

const CGROUP_ROOT = "/sys/fs/cgroup";
const PROC_ROOT = "/proc";

function safeLabel(value) {
  return String(value ?? "webkit")
    .replace(/[^a-zA-Z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 120) || "webkit";
}

function relativeReference(root, filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function sanitizeText(value, limit = 256) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .trim()
    .slice(0, limit);
}

function sanitizeValue(value, depth = 0) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return sanitizeText(value);
  if (depth >= 4) return "[bounded]";
  if (Array.isArray(value)) return value.slice(0, 32).map((entry) => sanitizeValue(entry, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => /^[a-zA-Z0-9._-]{1,64}$/u.test(key))
      .slice(0, 32)
      .map(([key, entry]) => [key, sanitizeValue(entry, depth + 1)]));
  }
  return sanitizeText(value);
}

async function readText(filePath) {
  return readFile(filePath, "utf8").catch(() => null);
}

async function readDirectory(filePath) {
  return readdir(filePath).catch(() => []);
}

function parseInteger(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === "max") return "max";
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableInteger(value) {
  const parsed = parseInteger(value);
  return typeof parsed === "number" ? parsed : null;
}

function parseKeyValueLines(source) {
  if (!source) return {};
  return Object.fromEntries(source.split(/\r?\n/gu).map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.search(/[\s:]/u);
    if (separator < 0) return [line, null];
    const key = line.slice(0, separator);
    const rawValue = line.slice(separator + 1).trim();
    return [key, parseInteger(rawValue.split(/\s+/u)[0])];
  }));
}

export function parseWebKitCoreDumping(source) {
  const value = parseKeyValueLines(source).CoreDumping;
  return value === 0 || value === 1 ? value : null;
}

function memoryInfo(source) {
  const values = parseKeyValueLines(source);
  const bytes = (key) => typeof values[key] === "number" ? values[key] * 1024 : null;
  return {
    totalBytes: bytes("MemTotal"),
    availableBytes: bytes("MemAvailable"),
    swapTotalBytes: bytes("SwapTotal"),
    swapFreeBytes: bytes("SwapFree"),
    slabBytes: bytes("Slab"),
  };
}

function pressureInfo(source) {
  if (!source) return null;
  const result = {};
  for (const line of source.split(/\r?\n/gu).map((entry) => entry.trim()).filter(Boolean)) {
    const [kind, ...fields] = line.split(/\s+/u);
    result[kind] = Object.fromEntries(fields.map((field) => {
      const [key, rawValue] = field.split("=");
      const value = key === "total" ? Number.parseInt(rawValue, 10) : Number.parseFloat(rawValue);
      return [key, Number.isFinite(value) ? value : null];
    }));
  }
  return result;
}

export function webKitHostProcessRole(name) {
  const normalized = String(name ?? "").toLowerCase();
  if (normalized.startsWith("webkitweb") || normalized.startsWith("wpeweb") || normalized === "webprocess") return "webkit-web-content";
  if (normalized.startsWith("webkitnetwork") || normalized.startsWith("wpenetwork") || normalized.includes("networkprocess")) return "webkit-network";
  if (normalized.startsWith("webkitgpu") || normalized.startsWith("wpegpu") || normalized.includes("gpuprocess")) return "webkit-gpu";
  if (normalized.includes("minibrowser")) return "webkit-browser-root";
  if (normalized === "node" || normalized === "node.exe") return "node-host";
  return `other-${safeLabel(normalized || "unknown")}`;
}

export function parseWebKitHostProcStat(source) {
  const normalized = String(source ?? "").trim();
  const open = normalized.indexOf("(");
  const close = normalized.lastIndexOf(")");
  if (open <= 0 || close <= open) return null;
  const pid = Number.parseInt(normalized.slice(0, open).trim(), 10);
  const suffix = normalized.slice(close + 1).trim().split(/\s+/u);
  if (!Number.isFinite(pid) || suffix.length < 21 || !/^[A-Za-z]$/u.test(suffix[0])) return null;
  const fields = suffix.slice(1);
  return {
    pid,
    name: sanitizeText(normalized.slice(open + 1, close), 64),
    state: suffix[0],
    ppid: Number.parseInt(fields[0], 10),
    minorFaults: nullableInteger(fields[6]),
    majorFaults: nullableInteger(fields[8]),
    userTicks: nullableInteger(fields[10]),
    systemTicks: nullableInteger(fields[11]),
    threads: nullableInteger(fields[16]),
    startTicks: parseInteger(fields[18]),
    virtualBytes: parseInteger(fields[19]),
    delayacctBlkioTicks: nullableInteger(fields[38]),
  };
}

const PROC_IO_COUNTERS = Object.freeze([
  "rchar",
  "wchar",
  "syscr",
  "syscw",
  "read_bytes",
  "write_bytes",
  "cancelled_write_bytes",
]);

export function parseWebKitWaitOwnerProcIo(source) {
  const parsed = parseKeyValueLines(source);
  return Object.fromEntries(PROC_IO_COUNTERS.map((key) => [key, nullableInteger(parsed[key])]));
}

export function sanitizeWebKitWaitOwnerStack(source) {
  const allLines = String(source ?? "").split(/\r?\n/gu).map((line) => sanitizeText(line, 256)).filter(Boolean);
  return {
    lines: allLines.slice(0, 16),
    truncated: allLines.length > 16,
    sourceLineCount: allLines.length,
  };
}

export function classifyWebKitWaitOwnerReadError(error) {
  const code = sanitizeText(error?.code ?? "UNKNOWN", 32) || "UNKNOWN";
  if (code === "EACCES" || code === "EPERM") return { status: "permission-denied", errorCode: code };
  if (code === "ENOENT" || code === "ESRCH") return { status: "process-disappeared", errorCode: code };
  return { status: "unavailable", errorCode: code };
}

export function webKitHostTelemetryValidity({
  supported,
  rootObservedCount,
  webContentObservedCount,
  dStateSampleCount = 0,
  waitOwnerAttemptCount = 0,
  waitOwnerCaptureErrorCount = 0,
}) {
  if (!supported) return { valid: null, invalidReason: null };
  if (rootObservedCount === 0) return { valid: false, invalidReason: "root-process-never-observed" };
  if (webContentObservedCount === 0) return { valid: false, invalidReason: "webkit-web-content-never-observed" };
  if (dStateSampleCount > waitOwnerAttemptCount) return { valid: false, invalidReason: "d-state-wait-owner-attempt-missing" };
  if (waitOwnerCaptureErrorCount > 0) return { valid: false, invalidReason: "d-state-wait-owner-capture-error" };
  return { valid: true, invalidReason: null };
}

async function readWaitOwnerProcFile(filePath) {
  try {
    return { status: "available", errorCode: null, source: await readFile(filePath, "utf8") };
  } catch (error) {
    return { ...classifyWebKitWaitOwnerReadError(error), source: null };
  }
}

function readResult(status, value = null, extra = {}) {
  return {
    status: status.status,
    errorCode: status.errorCode ?? null,
    value,
    ...extra,
  };
}

function ioPressureFullAvg10(host) {
  const value = host?.pressure?.io?.full?.avg10;
  return typeof value === "number" ? value : null;
}

async function captureWebKitWaitOwner({ processEntry, rootPid, elapsedMs, host, cgroup, operationContext }) {
  const identity = `${processEntry.pid}:${processEntry.startTicks}`;
  const processRoot = processEntry.pid === rootPid ? `${PROC_ROOT}/self` : `${PROC_ROOT}/${processEntry.pid}`;
  const [wchanRead, ioRead, statRead, stackRead] = await Promise.all([
    readWaitOwnerProcFile(`${processRoot}/wchan`),
    readWaitOwnerProcFile(`${processRoot}/io`),
    readWaitOwnerProcFile(`${processRoot}/stat`),
    readWaitOwnerProcFile(`${processRoot}/stack`),
  ]);
  const parsedStat = statRead.source === null ? null : parseWebKitHostProcStat(statRead.source);
  const identityMatched = parsedStat?.pid === processEntry.pid && parsedStat?.startTicks === processEntry.startTicks;
  const statStatus = statRead.status !== "available"
    ? statRead.status
    : parsedStat === null ? "parse-failed" : identityMatched ? "available" : "identity-changed";
  const stack = stackRead.source === null ? { lines: [], truncated: false, sourceLineCount: 0 } : sanitizeWebKitWaitOwnerStack(stackRead.source);
  const detailedStatus = [wchanRead, ioRead, statRead, stackRead].some(({ status }) => status === "available")
    ? "captured"
    : "unavailable";
  return {
    schema: WEBKIT_WAIT_OWNER_SCHEMA,
    identity,
    pid: processEntry.pid,
    startTicks: processEntry.startTicks,
    role: processEntry.role,
    state: processEntry.state,
    detailStatus: detailedStatus,
    wchan: readResult(wchanRead, wchanRead.source === null ? null : sanitizeText(wchanRead.source, 160)),
    procIo: readResult(ioRead, ioRead.source === null ? null : parseWebKitWaitOwnerProcIo(ioRead.source)),
    procStat: readResult(
      { status: statStatus, errorCode: statRead.errorCode },
      parsedStat === null ? null : {
        pid: parsedStat.pid,
        startTicks: parsedStat.startTicks,
        identityMatched,
        minorFaults: parsedStat.minorFaults,
        majorFaults: parsedStat.majorFaults,
        userTicks: parsedStat.userTicks,
        systemTicks: parsedStat.systemTicks,
        threads: parsedStat.threads,
        delayacctBlkioTicks: parsedStat.delayacctBlkioTicks,
      },
    ),
    stack: readResult(stackRead, stack.lines, {
      truncated: stack.truncated,
      sourceLineCount: stack.sourceLineCount,
    }),
    observation: {
      elapsedMs,
      ioPressureFullAvg10: ioPressureFullAvg10(host),
      hostPressure: host?.pressure ?? null,
      cgroup,
      process: {
        pid: processEntry.pid,
        ppid: processEntry.ppid,
        startTicks: processEntry.startTicks,
        role: processEntry.role,
        state: processEntry.state,
        rssBytes: processEntry.rssBytes,
        threads: processEntry.threads,
        fileDescriptors: processEntry.fileDescriptors,
      },
      operationContext,
    },
  };
}

function cappedWebKitWaitOwner({ processEntry, elapsedMs, host, cgroup, operationContext }) {
  return {
    schema: WEBKIT_WAIT_OWNER_SCHEMA,
    identity: `${processEntry.pid}:${processEntry.startTicks}`,
    pid: processEntry.pid,
    startTicks: processEntry.startTicks,
    role: processEntry.role,
    state: processEntry.state,
    detailStatus: "detail-cap-reached",
    wchan: { status: "detail-cap-reached", errorCode: null, value: null },
    procIo: { status: "detail-cap-reached", errorCode: null, value: null },
    procStat: { status: "detail-cap-reached", errorCode: null, value: null },
    stack: { status: "detail-cap-reached", errorCode: null, value: [], truncated: false, sourceLineCount: 0 },
    observation: {
      elapsedMs,
      ioPressureFullAvg10: ioPressureFullAvg10(host),
      hostPressure: host?.pressure ?? null,
      cgroup,
      process: {
        pid: processEntry.pid,
        ppid: processEntry.ppid,
        startTicks: processEntry.startTicks,
        role: processEntry.role,
        state: processEntry.state,
        rssBytes: processEntry.rssBytes,
        threads: processEntry.threads,
        fileDescriptors: processEntry.fileDescriptors,
      },
      operationContext,
    },
  };
}

async function readProcess(pid, rootPid) {
  const processRoot = pid === rootPid ? `${PROC_ROOT}/self` : `${PROC_ROOT}/${pid}`;
  const [statSource, statusSource, oomScoreSource, childSource, fileDescriptors] = await Promise.all([
    readText(`${processRoot}/stat`),
    readText(`${processRoot}/status`),
    readText(`${processRoot}/oom_score`),
    readText(`${processRoot}/task/${pid}/children`),
    readDirectory(`${processRoot}/fd`),
  ]);
  const stat = parseWebKitHostProcStat(statSource);
  if (!stat) return null;
  const status = parseKeyValueLines(statusSource);
  const children = (childSource ?? "").trim().split(/\s+/u)
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite);
  const role = webKitHostProcessRole(stat.name);
  return {
    pid: stat.pid,
    ppid: stat.ppid,
    startTicks: stat.startTicks,
    name: stat.name,
    role,
    webKitRole: role.startsWith("webkit-") ? role : null,
    state: stat.state,
    coreDumping: parseWebKitCoreDumping(statusSource),
    minorFaults: stat.minorFaults,
    majorFaults: stat.majorFaults,
    userTicks: stat.userTicks,
    systemTicks: stat.systemTicks,
    delayacctBlkioTicks: stat.delayacctBlkioTicks,
    rssBytes: typeof status.VmRSS === "number" ? status.VmRSS * 1024 : null,
    virtualBytes: typeof status.VmSize === "number" ? status.VmSize * 1024 : stat.virtualBytes,
    swapBytes: typeof status.VmSwap === "number" ? status.VmSwap * 1024 : null,
    threads: typeof status.Threads === "number" ? status.Threads : stat.threads,
    fileDescriptors: fileDescriptors.length,
    oomScore: parseInteger(oomScoreSource),
    children,
  };
}

async function boundedProcParentIndex() {
  const entries = (await readDirectory(PROC_ROOT))
    .filter((entry) => /^\d+$/u.test(entry))
    .map((entry) => Number.parseInt(entry, 10))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)
    .slice(0, 512);
  const stats = await Promise.all(entries.map(async (pid) => (
    parseWebKitHostProcStat(await readText(`${PROC_ROOT}/${pid}/stat`))
  )));
  const childrenByParent = new Map();
  for (const stat of stats.filter(Boolean)) {
    const children = childrenByParent.get(stat.ppid) ?? [];
    children.push(stat.pid);
    childrenByParent.set(stat.ppid, children);
  }
  return childrenByParent;
}

async function descendantTree(rootPid) {
  const queue = [rootPid];
  const seen = new Set();
  const processes = [];
  while (queue.length > 0 && seen.size < 512) {
    const pid = queue.shift();
    if (!Number.isFinite(pid) || seen.has(pid)) continue;
    seen.add(pid);
    const entry = await readProcess(pid, rootPid);
    if (!entry) continue;
    processes.push(entry);
    for (const child of entry.children) if (!seen.has(child)) queue.push(child);
  }
  let fallbackScanUsed = false;
  if (processes.length > 0 && !processes.some(({ role }) => role === "webkit-web-content")) {
    fallbackScanUsed = true;
    const childrenByParent = await boundedProcParentIndex();
    const fallbackQueue = [processes[0].pid];
    while (fallbackQueue.length > 0 && seen.size < 512) {
      const parentPid = fallbackQueue.shift();
      for (const childPid of childrenByParent.get(parentPid) ?? []) {
        if (seen.has(childPid)) continue;
        seen.add(childPid);
        const entry = await readProcess(childPid, rootPid);
        if (!entry) continue;
        processes.push(entry);
        fallbackQueue.push(entry.pid);
      }
    }
  }
  processes.sort((left, right) => left.pid - right.pid);
  return {
    processes,
    rootObserved: processes.length > 0,
    webContentObserved: processes.some(({ role }) => role === "webkit-web-content"),
    fallbackScanUsed,
  };
}

async function cgroupDirectory() {
  const source = await readText(`${PROC_ROOT}/self/cgroup`);
  const entry = source?.split(/\r?\n/gu).find((line) => line.startsWith("0::"));
  if (!entry) return CGROUP_ROOT;
  const relative = path.posix.normalize(`/${entry.slice(3)}`).replace(/^\/+/, "");
  const resolved = path.resolve(CGROUP_ROOT, relative);
  return resolved === CGROUP_ROOT || resolved.startsWith(`${CGROUP_ROOT}${path.sep}`) ? resolved : CGROUP_ROOT;
}

async function cgroupSnapshot() {
  const directory = await cgroupDirectory();
  const files = {
    memoryCurrent: "memory.current",
    memoryMax: "memory.max",
    memoryEvents: "memory.events",
    pidsCurrent: "pids.current",
    pidsMax: "pids.max",
    pidsEvents: "pids.events",
  };
  const entries = await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await readText(path.join(directory, file))]));
  const values = Object.fromEntries(entries);
  return {
    version: 2,
    memoryCurrent: parseInteger(values.memoryCurrent),
    memoryMax: parseInteger(values.memoryMax),
    memoryEvents: parseKeyValueLines(values.memoryEvents),
    pidsCurrent: parseInteger(values.pidsCurrent),
    pidsMax: parseInteger(values.pidsMax),
    pidsEvents: parseKeyValueLines(values.pidsEvents),
  };
}

function processAggregate(processes) {
  const sum = (key) => processes.reduce((total, entry) => total + (typeof entry[key] === "number" ? entry[key] : 0), 0);
  return {
    processCount: processes.length,
    descendantCount: Math.max(0, processes.length - 1),
    rssBytes: sum("rssBytes"),
    virtualBytes: sum("virtualBytes"),
    swapBytes: sum("swapBytes"),
    threads: sum("threads"),
    fileDescriptors: sum("fileDescriptors"),
  };
}

function counterDelta(first = {}, last = {}) {
  const keys = new Set([...Object.keys(first), ...Object.keys(last)]);
  return Object.fromEntries([...keys].sort().map((key) => {
    const before = typeof first[key] === "number" ? first[key] : 0;
    const after = typeof last[key] === "number" ? last[key] : 0;
    return [key, after - before];
  }));
}

function waitChannelFingerprint(attempt) {
  const status = attempt.wchan?.status ?? "missing";
  const value = attempt.wchan?.value ?? "null";
  return sanitizeText(`${status}:${value}`, 192);
}

function updateWaitOwnerIdentitySummary(summaries, attempt) {
  const prior = summaries.get(attempt.identity) ?? {
    schema: WEBKIT_WAIT_OWNER_SCHEMA,
    identity: attempt.identity,
    pid: attempt.pid,
    startTicks: attempt.startTicks,
    role: attempt.role,
    totalDSampleCount: 0,
    detailedAttemptCount: 0,
    capturedCount: 0,
    unavailableCount: 0,
    cappedCount: 0,
    firstElapsedMs: null,
    lastElapsedMs: null,
    maxIoPressureFullAvg10: null,
    waitChannelFingerprints: new Map(),
    firstProcIo: null,
    lastProcIo: null,
    firstDelayacctBlkioTicks: null,
    lastDelayacctBlkioTicks: null,
  };
  prior.totalDSampleCount += 1;
  if (attempt.detailStatus === "detail-cap-reached") prior.cappedCount += 1;
  else {
    prior.detailedAttemptCount += 1;
    if (attempt.detailStatus === "captured") prior.capturedCount += 1;
    else prior.unavailableCount += 1;
  }
  const elapsedMs = attempt.observation?.elapsedMs;
  if (typeof elapsedMs === "number") {
    prior.firstElapsedMs ??= elapsedMs;
    prior.lastElapsedMs = elapsedMs;
  }
  const pressure = attempt.observation?.ioPressureFullAvg10;
  if (typeof pressure === "number") {
    prior.maxIoPressureFullAvg10 = Math.max(prior.maxIoPressureFullAvg10 ?? pressure, pressure);
  }
  const fingerprint = waitChannelFingerprint(attempt);
  prior.waitChannelFingerprints.set(fingerprint, (prior.waitChannelFingerprints.get(fingerprint) ?? 0) + 1);
  const procIo = attempt.procIo?.value;
  if (procIo) {
    prior.firstProcIo ??= procIo;
    prior.lastProcIo = procIo;
  }
  const blockDelay = attempt.procStat?.value?.delayacctBlkioTicks;
  if (typeof blockDelay === "number") {
    prior.firstDelayacctBlkioTicks ??= blockDelay;
    prior.lastDelayacctBlkioTicks = blockDelay;
  }
  summaries.set(attempt.identity, prior);
}

function serializedWaitOwnerSummaries(summaries) {
  return [...summaries.values()].sort((left, right) => left.identity.localeCompare(right.identity)).map((entry) => ({
    ...entry,
    waitChannelFingerprints: Object.fromEntries([...entry.waitChannelFingerprints.entries()].sort(([left], [right]) => left.localeCompare(right))),
  }));
}

export async function createWebKitHostResourceTelemetry({
  evidenceDir,
  label,
  metadata = {},
  referenceRoot = process.cwd(),
  rootPid = process.pid,
  sampleIntervalMs = WEBKIT_HOST_RESOURCE_TELEMETRY_INTERVAL_MS,
  platform = process.platform,
} = {}) {
  if (!evidenceDir) throw new Error("WebKit host resource telemetry evidenceDir is required");
  if (sampleIntervalMs !== WEBKIT_HOST_RESOURCE_TELEMETRY_INTERVAL_MS) {
    throw new Error(`WebKit host resource telemetry cadence must remain ${WEBKIT_HOST_RESOURCE_TELEMETRY_INTERVAL_MS} ms`);
  }
  const outputDirectory = path.resolve(evidenceDir);
  await mkdir(outputDirectory, { recursive: true });
  const boundedLabel = safeLabel(label);
  const logPath = path.join(outputDirectory, `${boundedLabel}-host-resource.jsonl`);
  const summaryPath = path.join(outputDirectory, `${boundedLabel}-host-resource-summary.json`);
  const supported = platform === "linux";
  const reason = supported ? null : "linux-proc-cgroup-unavailable";
  const startedAt = Date.now();
  const safeMetadata = sanitizeValue(metadata);
  let writeQueue = Promise.resolve();
  let writeError = null;
  let stopped = false;
  let stopPromise = null;
  let periodicPending = false;
  let periodicSkippedCount = 0;
  let sequence = 0;
  let sampleCount = 0;
  let eventCount = 0;
  let firstCgroup = null;
  let lastCgroup = null;
  let lastProcesses = [];
  let priorIdentity = new Map();
  let rootObservedCount = 0;
  let webContentObservedCount = 0;
  let fallbackScanCount = 0;
  let currentOperationContext = sanitizeValue({ operationId: "telemetry-idle", status: "idle" });
  let dStateSampleCount = 0;
  let waitOwnerAttemptCount = 0;
  let waitOwnerDetailedCaptureCount = 0;
  let waitOwnerUnavailableCount = 0;
  let waitOwnerCappedCount = 0;
  let waitOwnerCaptureErrorCount = 0;
  let waitOwnerFirstElapsedMs = null;
  let waitOwnerLastElapsedMs = null;
  let waitOwnerMaxIoPressureFullAvg10 = null;
  let waitOwnerFirstProcIo = null;
  let waitOwnerLastProcIo = null;
  let waitOwnerFirstDelayacctBlkioTicks = null;
  let waitOwnerLastDelayacctBlkioTicks = null;
  const waitOwnerFingerprints = new Map();
  const waitOwnerDetailCounts = new Map();
  const waitOwnerIdentitySummaries = new Map();
  const collectionErrors = new Set();
  const disappearedRoles = new Set();
  const lastKnownWebKitRoles = new Set();
  const peaks = {
    aggregateRssBytes: 0,
    aggregateSwapBytes: 0,
    aggregateFileDescriptors: 0,
    aggregateThreads: 0,
    processCount: 0,
    descendantCount: 0,
    cgroupMemoryCurrent: 0,
    cgroupPidsCurrent: 0,
  };

  const reference = () => ({
    schema: WEBKIT_HOST_RESOURCE_TELEMETRY_SCHEMA,
    supported,
    reason,
    sampleIntervalMs,
    waitOwnerSchema: WEBKIT_WAIT_OWNER_SCHEMA,
    waitOwnerDetailLimit: WEBKIT_WAIT_OWNER_DETAIL_LIMIT,
    rootPid,
    log: relativeReference(referenceRoot, logPath),
    summary: relativeReference(referenceRoot, summaryPath),
  });

  const manifest = (status, extra = {}) => ({
    ...reference(),
    status,
    label: boundedLabel,
    metadata: safeMetadata,
    startedAt: new Date(startedAt).toISOString(),
    ...extra,
  });

  await writeFile(logPath, "", "utf8");
  await writeFile(summaryPath, `${JSON.stringify(manifest("running", {
    sampleCount: 0,
    eventCount: 0,
    periodicSkippedCount: 0,
  }), null, 2)}\n`, "utf8");

  async function collectEntry(kind, event, details, operationContext) {
    const capturedAt = Date.now();
    let host = null;
    let cgroup = null;
    let processes = [];
    let aggregate = null;
    let disappeared = [];
    let waitOwners = [];
    if (supported) {
      const [meminfoSource, memoryPressureSource, cpuPressureSource, ioPressureSource, collectedCgroup, collectedTree] = await Promise.all([
        readText(`${PROC_ROOT}/meminfo`),
        readText(`${PROC_ROOT}/pressure/memory`),
        readText(`${PROC_ROOT}/pressure/cpu`),
        readText(`${PROC_ROOT}/pressure/io`),
        cgroupSnapshot(),
        descendantTree(rootPid),
      ]);
      host = {
        memory: memoryInfo(meminfoSource),
        pressure: {
          memory: pressureInfo(memoryPressureSource),
          cpu: pressureInfo(cpuPressureSource),
          io: pressureInfo(ioPressureSource),
        },
      };
      cgroup = collectedCgroup;
      processes = collectedTree.processes;
      if (collectedTree.rootObserved) rootObservedCount += 1;
      else collectionErrors.add("root-process-unobserved");
      if (collectedTree.webContentObserved) webContentObservedCount += 1;
      if (collectedTree.fallbackScanUsed) fallbackScanCount += 1;
      aggregate = processAggregate(processes);
      const currentIdentity = new Map(processes.map((entry) => [`${entry.pid}:${entry.startTicks}`, entry.role]));
      disappeared = [...priorIdentity.entries()]
        .filter(([identity]) => !currentIdentity.has(identity))
        .map(([identity, role]) => ({ identity, role }));
      for (const entry of disappeared) disappearedRoles.add(entry.role);
      priorIdentity = currentIdentity;
      for (const entry of processes) if (entry.webKitRole) lastKnownWebKitRoles.add(entry.webKitRole);
      firstCgroup ??= cgroup;
      lastCgroup = cgroup;
      lastProcesses = processes;
      peaks.aggregateRssBytes = Math.max(peaks.aggregateRssBytes, aggregate.rssBytes);
      peaks.aggregateSwapBytes = Math.max(peaks.aggregateSwapBytes, aggregate.swapBytes);
      peaks.aggregateFileDescriptors = Math.max(peaks.aggregateFileDescriptors, aggregate.fileDescriptors);
      peaks.aggregateThreads = Math.max(peaks.aggregateThreads, aggregate.threads);
      peaks.processCount = Math.max(peaks.processCount, aggregate.processCount);
      peaks.descendantCount = Math.max(peaks.descendantCount, aggregate.descendantCount);
      peaks.cgroupMemoryCurrent = Math.max(peaks.cgroupMemoryCurrent, typeof cgroup.memoryCurrent === "number" ? cgroup.memoryCurrent : 0);
      peaks.cgroupPidsCurrent = Math.max(peaks.cgroupPidsCurrent, typeof cgroup.pidsCurrent === "number" ? cgroup.pidsCurrent : 0);
      const blockedWebContent = processes.filter(({ role, state }) => role === "webkit-web-content" && state === "D");
      waitOwners = await Promise.all(blockedWebContent.map(async (processEntry) => {
        dStateSampleCount += 1;
        const identity = `${processEntry.pid}:${processEntry.startTicks}`;
        const priorDetailCount = waitOwnerDetailCounts.get(identity) ?? 0;
        let attempt;
        if (priorDetailCount >= WEBKIT_WAIT_OWNER_DETAIL_LIMIT) {
          waitOwnerCappedCount += 1;
          attempt = cappedWebKitWaitOwner({ processEntry, elapsedMs: capturedAt - startedAt, host, cgroup, operationContext });
        } else {
          waitOwnerDetailCounts.set(identity, priorDetailCount + 1);
          try {
            attempt = await captureWebKitWaitOwner({ processEntry, rootPid, elapsedMs: capturedAt - startedAt, host, cgroup, operationContext });
          } catch (error) {
            waitOwnerCaptureErrorCount += 1;
            collectionErrors.add("wait-owner-capture-error");
            attempt = {
              schema: WEBKIT_WAIT_OWNER_SCHEMA,
              identity,
              pid: processEntry.pid,
              startTicks: processEntry.startTicks,
              role: processEntry.role,
              state: processEntry.state,
              detailStatus: "capture-error",
              captureError: sanitizeText(error, 256),
              wchan: { status: "capture-error", errorCode: null, value: null },
              procIo: { status: "capture-error", errorCode: null, value: null },
              procStat: { status: "capture-error", errorCode: null, value: null },
              stack: { status: "capture-error", errorCode: null, value: [], truncated: false, sourceLineCount: 0 },
              observation: {
                elapsedMs: capturedAt - startedAt,
                ioPressureFullAvg10: ioPressureFullAvg10(host),
                hostPressure: host?.pressure ?? null,
                cgroup,
                process: processEntry,
                operationContext,
              },
            };
          }
        }
        waitOwnerAttemptCount += 1;
        if (attempt.detailStatus === "captured") waitOwnerDetailedCaptureCount += 1;
        else if (attempt.detailStatus !== "detail-cap-reached") waitOwnerUnavailableCount += 1;
        const elapsedMs = attempt.observation?.elapsedMs;
        if (typeof elapsedMs === "number") {
          waitOwnerFirstElapsedMs ??= elapsedMs;
          waitOwnerLastElapsedMs = elapsedMs;
        }
        const pressure = attempt.observation?.ioPressureFullAvg10;
        if (typeof pressure === "number") {
          waitOwnerMaxIoPressureFullAvg10 = Math.max(waitOwnerMaxIoPressureFullAvg10 ?? pressure, pressure);
        }
        const fingerprint = waitChannelFingerprint(attempt);
        waitOwnerFingerprints.set(fingerprint, (waitOwnerFingerprints.get(fingerprint) ?? 0) + 1);
        if (attempt.procIo?.value) {
          waitOwnerFirstProcIo ??= attempt.procIo.value;
          waitOwnerLastProcIo = attempt.procIo.value;
        }
        const blockDelay = attempt.procStat?.value?.delayacctBlkioTicks;
        if (typeof blockDelay === "number") {
          waitOwnerFirstDelayacctBlkioTicks ??= blockDelay;
          waitOwnerLastDelayacctBlkioTicks = blockDelay;
        }
        updateWaitOwnerIdentitySummary(waitOwnerIdentitySummaries, attempt);
        return attempt;
      }));
    }
    const entry = {
      schema: WEBKIT_HOST_RESOURCE_TELEMETRY_SCHEMA,
      sequence: ++sequence,
      kind,
      event: event ?? null,
      timestamp: new Date(capturedAt).toISOString(),
      elapsedMs: capturedAt - startedAt,
      supported,
      reason,
      metadata: safeMetadata,
      details: sanitizeValue(details ?? {}),
      operationContext,
      nodeMemory: process.memoryUsage(),
      host,
      cgroup,
      processes,
      aggregate,
      disappeared,
      waitOwners,
    };
    if (kind === "sample") sampleCount += 1;
    if (kind === "event") eventCount += 1;
    await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    return entry;
  }

  function enqueue(kind, event = null, details = {}, { allowStopped = false } = {}) {
    if (stopped && !allowStopped) return writeQueue;
    const operationContext = sanitizeValue(currentOperationContext);
    const operation = writeQueue.then(() => collectEntry(kind, event, details, operationContext));
    writeQueue = operation.catch((error) => {
      writeError ??= error;
    });
    return writeQueue;
  }

  await enqueue("event", "telemetry-start", { rootPid });
  const interval = setInterval(() => {
    if (stopped) return;
    if (periodicPending) {
      periodicSkippedCount += 1;
      return;
    }
    periodicPending = true;
    void enqueue("sample", "periodic").finally(() => {
      periodicPending = false;
    });
  }, sampleIntervalMs);
  interval.unref?.();

  const event = (name, details = {}) => {
    void enqueue("event", sanitizeText(name, 96), details);
  };

  const setContext = (context = {}) => {
    if (stopped) return currentOperationContext;
    currentOperationContext = sanitizeValue(context);
    return currentOperationContext;
  };

  const flush = async () => {
    await writeQueue;
    if (writeError) throw new Error(`WebKit host resource telemetry write failed: ${writeError}`);
  };

  const stop = async (details = {}) => {
    if (stopPromise) return stopPromise;
    stopped = true;
    clearInterval(interval);
    stopPromise = (async () => {
      await enqueue("event", "telemetry-stop", details, { allowStopped: true });
      await writeQueue;
      const stoppedAt = Date.now();
      const validity = webKitHostTelemetryValidity({
        supported,
        rootObservedCount,
        webContentObservedCount,
        dStateSampleCount,
        waitOwnerAttemptCount,
        waitOwnerCaptureErrorCount,
      });
      const invalidReason = validity.invalidReason;
      const status = writeError ? "failed" : invalidReason ? "invalid" : "complete";
      const summary = manifest(status, {
        stoppedAt: new Date(stoppedAt).toISOString(),
        elapsedMs: stoppedAt - startedAt,
        sampleCount,
        eventCount,
        periodicSkippedCount,
        valid: validity.valid,
        invalidReason,
        rootObservedCount,
        webContentObservedCount,
        fallbackScanCount,
        waitOwner: {
          schema: WEBKIT_WAIT_OWNER_SCHEMA,
          detailLimitPerIdentity: WEBKIT_WAIT_OWNER_DETAIL_LIMIT,
          dStateSampleCount,
          attemptCount: waitOwnerAttemptCount,
          detailedCaptureCount: waitOwnerDetailedCaptureCount,
          unavailableCount: waitOwnerUnavailableCount,
          cappedCount: waitOwnerCappedCount,
          captureErrorCount: waitOwnerCaptureErrorCount,
          firstElapsedMs: waitOwnerFirstElapsedMs,
          lastElapsedMs: waitOwnerLastElapsedMs,
          maxIoPressureFullAvg10: waitOwnerMaxIoPressureFullAvg10,
          waitChannelFingerprints: Object.fromEntries([...waitOwnerFingerprints.entries()].sort(([left], [right]) => left.localeCompare(right))),
          firstProcIo: waitOwnerFirstProcIo,
          lastProcIo: waitOwnerLastProcIo,
          firstDelayacctBlkioTicks: waitOwnerFirstDelayacctBlkioTicks,
          lastDelayacctBlkioTicks: waitOwnerLastDelayacctBlkioTicks,
          identities: serializedWaitOwnerSummaries(waitOwnerIdentitySummaries),
        },
        collectionErrors: [...collectionErrors].sort().slice(0, 16),
        peaks,
        cgroupEventDeltas: supported ? {
          memory: counterDelta(firstCgroup?.memoryEvents, lastCgroup?.memoryEvents),
          pids: counterDelta(firstCgroup?.pidsEvents, lastCgroup?.pidsEvents),
        } : null,
        lastKnownWebKitRoleSet: [...lastKnownWebKitRoles].sort(),
        disappearedRoles: [...disappearedRoles].sort(),
        lastProcessRoles: lastProcesses.map(({ pid, ppid, startTicks, role, state }) => ({ pid, ppid, startTicks, role, state })),
        descendantLeftovers: lastProcesses
          .filter(({ pid }) => pid !== rootPid)
          .map(({ pid, ppid, startTicks, role, state }) => ({ pid, ppid, startTicks, role, state })),
        writeError: writeError ? sanitizeText(writeError) : null,
      });
      await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
      if (writeError) throw new Error(`WebKit host resource telemetry write failed: ${writeError}`);
      const persistedEntries = (await readFile(logPath, "utf8")).split(/\r?\n/gu)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const persistedSummary = JSON.parse(await readFile(summaryPath, "utf8"));
      const expectedEntryCount = sampleCount + eventCount;
      const persistedWaitOwnerAttemptCount = persistedEntries.reduce((total, entry) => total + (entry.waitOwners?.length ?? 0), 0);
      const persistedDStateSampleCount = persistedEntries.reduce((total, entry) => total + (entry.processes ?? [])
        .filter(({ role, state }) => role === "webkit-web-content" && state === "D").length, 0);
      if (persistedEntries.length !== expectedEntryCount
        || persistedEntries.some((entry, index) => entry.schema !== WEBKIT_HOST_RESOURCE_TELEMETRY_SCHEMA || entry.sequence !== index + 1)
        || persistedEntries[0]?.event !== "telemetry-start"
        || persistedEntries.at(-1)?.event !== "telemetry-stop"
        || persistedSummary.schema !== WEBKIT_HOST_RESOURCE_TELEMETRY_SCHEMA
        || persistedSummary.status !== status
        || persistedSummary.valid !== validity.valid
        || persistedWaitOwnerAttemptCount !== waitOwnerAttemptCount
        || persistedDStateSampleCount !== dStateSampleCount
        || persistedWaitOwnerAttemptCount !== persistedDStateSampleCount
        || persistedSummary.waitOwner?.attemptCount !== waitOwnerAttemptCount
        || persistedSummary.waitOwner?.dStateSampleCount !== dStateSampleCount) {
        throw new Error("WebKit host resource telemetry persistence integrity failed");
      }
      return summary;
    })();
    return stopPromise;
  };

  return {
    schema: WEBKIT_HOST_RESOURCE_TELEMETRY_SCHEMA,
    supported,
    reason,
    event,
    setContext,
    flush,
    stop,
    reference,
  };
}
