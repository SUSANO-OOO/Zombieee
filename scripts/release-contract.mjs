import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_FIELDS = Object.freeze([
  "version",
  "release_ref",
  "release_sha",
  "issue_number",
  "request_id",
]);

const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const REQUEST_ID_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{7,127}$/u;

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error(`${field} must be a nonempty, already-trimmed string`);
  }
  return value;
}

export function normalizeReleaseContract(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("release contract must be a JSON object");
  }

  const inputKeys = Object.keys(input).sort();
  const requiredKeys = [...REQUIRED_FIELDS].sort();
  const missing = requiredKeys.filter((key) => !inputKeys.includes(key));
  const unknown = inputKeys.filter((key) => !requiredKeys.includes(key));
  if (missing.length || unknown.length) {
    throw new Error(`release contract fields are invalid (missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"})`);
  }

  const version = requireString(input.version, "version");
  if (!VERSION_PATTERN.test(version)) {
    throw new Error("version must be an unprefixed semantic version such as 0.7.1");
  }

  const releaseSha = requireString(input.release_sha, "release_sha");
  if (!SHA_PATTERN.test(releaseSha)) {
    throw new Error("release_sha must be a 40-character lowercase commit SHA");
  }

  const releaseRef = requireString(input.release_ref, "release_ref");
  const expectedTag = `v${version}`;
  if (releaseRef !== expectedTag && releaseRef !== releaseSha) {
    throw new Error(`release_ref must be ${expectedTag} or the exact release_sha`);
  }

  if (!Number.isSafeInteger(input.issue_number) || input.issue_number < 1) {
    throw new Error("issue_number must be a positive integer");
  }

  const requestId = requireString(input.request_id, "request_id");
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new Error("request_id must be 8-128 safe identifier characters");
  }

  return Object.freeze({
    version,
    release_ref: releaseRef,
    release_sha: releaseSha,
    issue_number: input.issue_number,
    request_id: requestId,
  });
}

export function releaseContractFromEnvironment(environment = process.env) {
  const issueNumber = Number(environment.RELEASE_ISSUE_NUMBER);
  return normalizeReleaseContract({
    version: environment.RELEASE_VERSION,
    release_ref: environment.RELEASE_REF,
    release_sha: environment.RELEASE_SHA,
    issue_number: issueNumber,
    request_id: environment.RELEASE_REQUEST_ID,
  });
}

export async function readReleaseContract(filePath) {
  const source = await readFile(filePath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`release contract is not valid JSON: ${error.message}`);
  }
  return normalizeReleaseContract(parsed);
}

function serialize(contract) {
  return `${JSON.stringify(contract, null, 2)}\n`;
}

async function runCli() {
  const args = process.argv.slice(2);
  let sourceMode = null;
  let sourceFile = null;
  let outputFile = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--env") {
      if (sourceMode) throw new Error("choose exactly one release contract source");
      sourceMode = "env";
    } else if (argument === "--file") {
      if (sourceMode) throw new Error("choose exactly one release contract source");
      sourceMode = "file";
      sourceFile = args[index + 1];
      index += 1;
      if (!sourceFile) throw new Error("--file requires a path");
    } else if (argument === "--output") {
      outputFile = args[index + 1];
      index += 1;
      if (!outputFile) throw new Error("--output requires a path");
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (!sourceMode) throw new Error("use --file <path> or --env");
  const contract = sourceMode === "env"
    ? releaseContractFromEnvironment()
    : await readReleaseContract(path.resolve(sourceFile));
  const serialized = serialize(contract);
  if (outputFile) await writeFile(path.resolve(outputFile), serialized, "utf8");
  process.stdout.write(serialized);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
