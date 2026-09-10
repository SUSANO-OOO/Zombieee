import path from "node:path";
import { fileURLToPath } from "node:url";
import { regenerateMotionAtlases } from "./v100-reviewed-motion-generator.mjs";

const root = path.resolve(import.meta.dirname, "..");
const outputArgument = process.argv.slice(2).find((argument) => argument.startsWith("--output-dir="));
const outputDirectory = outputArgument ? path.resolve(root, outputArgument.slice("--output-dir=".length)) : path.join(root, "outputs/completion/motion-alpha-regenerated");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  regenerateMotionAtlases(outputDirectory).then((records) => {
    console.log(JSON.stringify(records.map((record) => ({ name: record.definition.name, output: record.output, sha256: record.metadata.sha256 })), null, 2));
  }).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
}
