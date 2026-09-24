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
  // Pure CJK text is a valid response in CJK languages; only CJK glued into Latin/Cyrillic prose counts
  if (CJK.test(text) && WESTERN.test(text)) return true;
  return MIXED_WORD.test(text) || (CYRILLIC.test(text) && HOMOGLYPH.test(text));
}

// Kana, CJK ideographs (+ ext A / compat), hangul
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
const CYRILLIC = /[\u0400-\u04ff]/;
// A run of Latin+Cyrillic letters containing at least one of each ("poль")
const MIXED_WORD = /(?=[a-z\u0430-\u044f\u0451]*[\u0430-\u044f\u0451])(?=[a-z\u0430-\u044f\u0451]*[a-z])[a-z\u0430-\u044f\u0451]+/i;
// Standalone single Latin letter with a Cyrillic look-alike ("переменная x")
const HOMOGLYPH = /\b[aoecpxyk]\b/i;
// Any Latin or Cyrillic letter - markers that the text is written in a western script
const WESTERN = /[a-z\u0400-\u04ff]/i;
