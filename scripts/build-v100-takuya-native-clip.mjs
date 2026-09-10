import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const reportPath = process.env.V100_TAKUYA_CLIP_REPORT;
const output = process.env.V100_TAKUYA_CLIP_OUT;
const mappingPath = process.env.V100_TAKUYA_CLIP_MAPPING;
assert.ok(reportPath, "V100_TAKUYA_CLIP_REPORT is required");
assert.ok(output, "V100_TAKUYA_CLIP_OUT is required");
assert.ok(mappingPath, "V100_TAKUYA_CLIP_MAPPING is required: verified video-to-game mapping");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const mapping = JSON.parse(await readFile(mappingPath, "utf8"));
assert.equal(report.status, "observed", "TAKUYA native report must be observed");
assert.equal(report.observed, true, "TAKUYA native report must prove one slam");
assert.deepEqual(report.errors ?? [], [], "TAKUYA native report contains runtime errors");
assert.ok(report.video, "TAKUYA native report must retain its source video");
assert.equal(mapping.method, "png-feature-match", "clip mapping must come from actual video PNG feature matching");
assert.ok(mapping.visualEvidence, "clip mapping must include visual evidence");
assert.ok(Number.isFinite(mapping.sourceStartSeconds) && Number.isFinite(mapping.sourceDurationSeconds) && mapping.sourceStartSeconds >= 0 && mapping.sourceDurationSeconds > 0, "clip mapping times are invalid");
const evidence = report.slamEvidence;
assert.ok(evidence?.windup?.length && evidence.impact?.length && evidence.recovery?.length && evidence.restored?.length, "TAKUYA slam phase evidence is incomplete");
const source = path.isAbsolute(report.video) ? report.video : path.resolve(process.cwd(), report.video);
const sourceStat = await stat(source);
assert.ok(sourceStat.size > 0, "TAKUYA source video is empty");
const first = evidence.windup[0].time;
const last = evidence.restored.at(-1).time;
assert.ok(Number.isFinite(first) && Number.isFinite(last) && last >= first, "TAKUYA evidence timing is invalid");
const start = mapping.sourceStartSeconds;
const duration = mapping.sourceDurationSeconds;
await mkdir(output, { recursive: true });
const run = args => execFileSync(ffmpeg.path, ["-y", "-hide_banner", "-loglevel", "error", ...args], { windowsHide: true, stdio: "pipe" });
const mp4 = path.join(output, "takuya-slam-native-r1.mp4");
const webm = path.join(output, "takuya-slam-native-r1.webm");
run(["-ss", String(start), "-i", source, "-t", String(duration), "-an", "-c:v", "libx264", "-profile:v", "baseline", "-level:v", "3.1", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
run(["-i", mp4, "-an", "-c:v", "libvpx", "-b:v", "2400k", "-deadline", "good", webm]);
const durationProbe = spawnSync(ffmpeg.path, ["-hide_banner", "-i", mp4, "-t", "0", "-f", "null", "-"], { windowsHide: true, encoding: "utf8" });
assert.match(String(durationProbe.stderr), /Duration:/u);
const sha256 = async file => createHash("sha256").update(await readFile(file)).digest("hex");
const outputs = [];
for (const file of [mp4, webm]) outputs.push({ file: path.relative(process.cwd(), file), bytes: (await stat(file)).size, sha256: await sha256(file) });
const provenance = {
  status: "prepared-native-clip",
  scope: "Native TAKUYA slam excerpt only; source gameplay video trimmed without overlays, retiming, added VFX, fabricated frames, audio, or app changes.",
  sourceReport: path.relative(process.cwd(), reportPath),
  sourceVideo: path.relative(process.cwd(), source),
  sourceSha256: await sha256(source),
  build: report.build?.combinedSha256 ?? null,
  evidence: { boss: "takuya", simulationWindupSeconds: first, simulationRestoredSeconds: last, simulationImpactSeconds: evidence.impact[0].time, simulationRecoverySeconds: evidence.recovery[0].time },
  mapping: { method: mapping.method, visualEvidence: mapping.visualEvidence, sourceStartSeconds: start, sourceDurationSeconds: duration },
  trim: { startSeconds: start, durationSeconds: duration },
  outputs,
};
await writeFile(path.join(output, "takuya-slam-native-provenance-r1.json"), `${JSON.stringify(provenance, null, 2)}\n`);
console.log(JSON.stringify(provenance, null, 2));
