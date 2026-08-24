import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const WEBKIT_HOST_RESOURCE_TELEMETRY_SCHEMA = "v100-webkit-host-resource-telemetry/v1";
export const WEBKIT_HOST_RESOURCE_TELEMETRY_INTERVAL_MS = 500;

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
    startTicks: parseInteger(fields[18]),
    virtualBytes: parseInteger(fields[19]),
  };
}

export function webKitHostTelemetryValidity({ supported, rootObservedCount, webContentObservedCount }) {
  if (!supported) return { valid: null, invalidReason: null };
  if (rootObservedCount === 0) return { valid: false, invalidReason: "root-process-never-observed" };
  if (webContentObservedCount === 0) return { valid: false, invalidReason: "webkit-web-content-never-observed" };
  return { valid: true, invalidReason: null };
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
    rssBytes: typeof status.VmRSS === "number" ? status.VmRSS * 1024 : null,
    virtualBytes: typeof status.VmSize === "number" ? status.VmSize * 1024 : stat.virtualBytes,
    swapBytes: typeof status.VmSwap === "number" ? status.VmSwap * 1024 : null,
    threads: typeof status.Threads === "number" ? status.Threads : null,
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

  async function collectEntry(kind, event, details) {
    const capturedAt = Date.now();
    let host = null;
    let cgroup = null;
    let processes = [];
    let aggregate = null;
    let disappeared = [];
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
      nodeMemory: process.memoryUsage(),
      host,
      cgroup,
      processes,
      aggregate,
      disappeared,
    };
    if (kind === "sample") sampleCount += 1;
    if (kind === "event") eventCount += 1;
    await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    return entry;
  }

  function enqueue(kind, event = null, details = {}, { allowStopped = false } = {}) {
    if (stopped && !allowStopped) return writeQueue;
    const operation = writeQueue.then(() => collectEntry(kind, event, details));
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
      const validity = webKitHostTelemetryValidity({ supported, rootObservedCount, webContentObservedCount });
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
      if (persistedEntries.length !== expectedEntryCount
        || persistedEntries.some((entry, index) => entry.schema !== WEBKIT_HOST_RESOURCE_TELEMETRY_SCHEMA || entry.sequence !== index + 1)
        || persistedEntries[0]?.event !== "telemetry-start"
        || persistedEntries.at(-1)?.event !== "telemetry-stop"
        || persistedSummary.schema !== WEBKIT_HOST_RESOURCE_TELEMETRY_SCHEMA
        || persistedSummary.status !== status
        || persistedSummary.valid !== validity.valid) {
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
    flush,
    stop,
    reference,
  };
}
