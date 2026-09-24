import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fixText } from "./corrector.ts";
import { needsFix } from "./detector.ts";

// Live tests against the real corrector model; skipped without credentials
const skip = !process.env.NEURALWATT_API_KEY;

let registryPromise: Promise<ModelRegistry> | undefined;
function registry(): Promise<ModelRegistry> {
  return (registryPromise ??= ModelRuntime.create({}).then((r) => new ModelRegistry(r)));
}

test("fixes CJK glued into Russian prose", { skip }, async () => {
  const fixed = await fixText("Ящик工作报告 и так стоит 24/7, так что можно не переживать.", await registry());
  assert.ok(fixed);
  assert.ok(!needsFix(fixed));
  console.log("cjk:", fixed);
});

test("fixes homoglyph flips in Russian prose", { skip }, async () => {
  const fixed = await fixText("Двойной poль в этом сценарии выглядит странно, но poль всё же важна.", await registry());
  assert.ok(fixed);
  assert.ok(!needsFix(fixed));
  console.log("homoglyph:", fixed);
});

test("keeps paths, files, and numbers intact", { skip }, async () => {
  const fixed = await fixText("Готово: файлы src/index.ts и package.json обновлены, аптайм 24/7, отчёт c цифрами приложен.", await registry());
  assert.ok(fixed);
  for (const token of ["src/index.ts", "package.json", "24/7"]) {
    assert.ok(fixed.includes(token), `lost: ${token}`);
  }
  console.log("tokens:", fixed);
});

test("returns clean English unchanged", { skip }, async () => {
  const text = "The migration ran clean and the index is rebuilt, see report.md for details.";
  assert.equal(await fixText(text, await registry()), text);
});
