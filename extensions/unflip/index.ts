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
  return hasCJKFlip(text) || MIXED_WORD.test(text) || (CYRILLIC.test(text) && HOMOGLYPH.test(text));
}

function hasCJKFlip(text: string): boolean {
  // Japanese: hanzi are part of the language
  if (text.match(KANA)) return false;
  const hanzi = text.match(HANZI)?.length ?? 0;
  if (hanzi === 0) return false;
  // Hanzi are pollution only when they don't carry the text - Chinese answers are hanzi-majority
  const nonHanzi = (text.match(WESTERN)?.length ?? 0) + (text.match(HANGUL)?.length ?? 0);
  return hanzi < nonHanzi;
}

// Hiragana + katakana
const KANA = /[\u3040-\u30ff]/g;
// CJK ideographs (ext A, unified, compat)
const HANZI = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
// Hangul syllables
const HANGUL = /[\uac00-\ud7af]/g;
const CYRILLIC = /[\u0400-\u04ff]/;
// A run of Latin+Cyrillic letters containing at least one of each ("poль")
const MIXED_WORD = /(?=[a-z\u0430-\u044f\u0451]*[\u0430-\u044f\u0451])(?=[a-z\u0430-\u044f\u0451]*[a-z])[a-z\u0430-\u044f\u0451]+/i;
// Standalone single Latin letter with a Cyrillic look-alike ("переменная x")
const HOMOGLYPH = /\b[aoecpxyk]\b/i;
// Latin or Cyrillic letters
const WESTERN = /[a-z\u0400-\u04ff]/gi;
