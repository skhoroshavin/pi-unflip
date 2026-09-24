import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fixText } from "./corrector.ts";
import { needsFix } from "./detector.ts";

// Live tests against the real corrector model; skipped without credentials
const skip = !process.env.NEURALWATT_API_KEY;

test("fixes CJK glued into English prose", { skip }, async () => {
  await fixAndCheck("The migration ran clean, 报告 and the index is rebuilt.");
  await fixAndCheck("The cache server 报告 is warm, so sessions persist across restarts.");
});

test("fixes Cyrillic homoglyph flips in English prose", { skip }, async () => {
  await fixAndCheck("The сache is warm, and the рipeline is green.");
});

test("fixes corrupted Russian prose", { skip }, async () => {
  const fixed = await fixAndCheck("Двойной poль в этом сценарии выглядит странно. Она выполнила задачу c первого раза.");
  assert.ok(fixed.includes("Двойная роль"), fixed);
});

test("reconstructs CJK phrases instead of discarding", { skip }, async () => {
  const fixed = await fixAndCheck("Обновление сломало сборку, но фикс уже в测试, скоро выкачу.");
  assert.ok(fixed.includes("в тесте"), fixed);
});

test("fixes hanzi flips in Korean text", { skip }, async () => {
  await fixAndCheck("마이그레이션이 완료되었고 报告 인덱스가 다시 생성되었습니다.");
});

let registryPromise: Promise<ModelRegistry> | undefined;
function registry(): Promise<ModelRegistry> {
  return (registryPromise ??= ModelRuntime.create({
    modelsPath: new URL("./models.fixture.json", import.meta.url).pathname,
    modelsStorePath: "/tmp/pi-unflip-models-store.json",
  }).then((r) => new ModelRegistry(r)));
}

async function fixAndCheck(sample: string): Promise<string> {
  const fixed = await fixText(sample, await registry());
  assert.ok(fixed, `no fix for: ${sample}`);
  assert.ok(!needsFix(fixed), `still corrupted: ${fixed}`);
  console.log(fixed);
  return fixed;
}
