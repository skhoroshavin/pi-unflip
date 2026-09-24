import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CORRECTOR_MODEL = "neuralwatt/deepseek-v4-flash";

export default function (pi: ExtensionAPI) {
  pi.on("message_end", async (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant" || message.stopReason !== "stop") return;
    let text = "";
    for (const block of message.content) {
      if (block.type === "toolCall") return;
      if (block.type === "text") text += block.text;
    }
    if (needsFix(text)) {
      ctx.ui.notify("unflip: corrupted text detected", "warning");
    }
  });
}

export function needsFix(text: string): boolean {
  // CJK-majority text is a legit CJK answer with occasional English; stray CJK in western prose is corruption
  const cjk = text.match(CJK)?.length ?? 0;
  if (cjk > 0 && cjk < (text.match(WESTERN)?.length ?? 0)) return true;
  return MIXED_WORD.test(text) || (CYRILLIC.test(text) && HOMOGLYPH.test(text));
}

// Kana, CJK ideographs (+ ext A / compat), hangul; /g for counting matches
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
const CYRILLIC = /[\u0400-\u04ff]/;
// A run of Latin+Cyrillic letters containing at least one of each ("poль")
const MIXED_WORD = /(?=[a-z\u0430-\u044f\u0451]*[\u0430-\u044f\u0451])(?=[a-z\u0430-\u044f\u0451]*[a-z])[a-z\u0430-\u044f\u0451]+/i;
// Standalone single Latin letter with a Cyrillic look-alike ("переменная x")
const HOMOGLYPH = /\b[aoecpxyk]\b/i;
// Latin or Cyrillic letters; /g for counting matches
const WESTERN = /[a-z\u0400-\u04ff]/gi;
