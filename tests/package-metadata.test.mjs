import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root package metadata is private and separate from product release identity", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const packageLock = JSON.parse(await readFile("package-lock.json", "utf8"));
  const root = packageLock.packages?.[""];
  const releaseIdentity = await readFile("app/releaseIdentity.js", "utf8");

  assert.equal(packageJson.name, "zombieee-private");
  assert.equal(packageJson.version, "0.0.0");
  assert.equal(packageJson.private, true);
  assert.match(packageJson.description, /product version source is app\/releaseIdentity\.js/u);
  assert.equal(root?.name, packageJson.name);
  assert.equal(root?.version, packageJson.version);
  assert.equal(root?.private, true);
  assert.deepEqual(root?.dependencies, packageJson.dependencies);
  assert.deepEqual(root?.devDependencies, packageJson.devDependencies);
  assert.match(releaseIdentity, /RELEASE_VERSION/u);
  assert.doesNotMatch(JSON.stringify(packageJson), /0\.9\.9\.0/u);
});
