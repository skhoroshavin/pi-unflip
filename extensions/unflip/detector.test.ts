import { strict as assert } from "node:assert";
import { test } from "node:test";
import { needsFix } from "./detector.ts";

test("stays quiet on Latin-script text", () => {
  assert.equal(needsFix("The migration ran clean and the index is rebuilt, see report.md for details."), false);
  assert.equal(needsFix("Updated the config: maxTokens = 393216, contextWindow = 1048560."), false);
  assert.equal(needsFix("Die Größe des Caches wurde erhöht, siehe config.yaml für Details."), false);
  assert.equal(needsFix("La migración terminó correctamente, el índice quedó reconstruido."), false);
});

test("fires on CJK glued into English prose", () => {
  assert.ok(needsFix("The migration ran clean, 报告 and the index is rebuilt."));
  assert.ok(needsFix("The cache server 报告 is warm, so sessions persist across restarts."));
});

test("fires on Cyrillic homoglyph flips in English prose", () => {
  assert.ok(needsFix("The сache is warm, and the рipeline is green."));
});

test("fires on corrupted Russian prose", () => {
  assert.ok(needsFix("Двойной poль в этом сценaрии выглядит стpaнно, но poль всё же важна."));
  assert.ok(needsFix("sтвол дерева достаточно толстый."));
  assert.ok(needsFix("Раcсказ получилсja коротким, но ёмким."));
});

test("stays quiet on standalone Latin letters in Russian prose", () => {
  assert.equal(needsFix("Коэффициенты x, y и z подобраны, точка a лежит на кривой."), false);
  assert.equal(needsFix("Поколения 'X' и \"Z\""), false);
  assert.equal(needsFix("Координаты (x, y)"), false);
});

test("stays quiet on clean Russian", () => {
  assert.equal(needsFix("Роль назначена, права выданы, всё работает с 24/7 аптаймом."), false);
  assert.equal(needsFix("Готово: файлы src/index.ts и package.json обновлены, тесты зелёные."), false);
});

test("fires on hanzi flips in Korean text", () => {
  assert.ok(needsFix("마이그레이션이 완료되었고 报告 인덱스가 다시 생성되었습니다."));
});

test("stays quiet on Chinese and Korean responses with occasional English words and numbers", () => {
  assert.equal(needsFix("迁移完成，升级到 node v22 后重试，耗时 3 分钟。"), false);
  assert.equal(needsFix("마이그레이션 완료, npm run build도 성공했습니다, 약 3분 걸렸습니다."), false);
});
