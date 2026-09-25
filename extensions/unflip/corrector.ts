import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { needsFix } from "./detector.ts";

const CORRECTOR_MODEL = "neuralwatt/deepseek-v4-flash";

export async function fixText(
  target: string,
  context: string,
  registry: ModelRegistry,
  signal?: AbortSignal,
): Promise<string | null> {
  const [provider, id] = CORRECTOR_MODEL.split("/");
  const model = registry.find(provider, id);
  if (!model) return null;
  const request =
    (context === target ? "" : `Full reply for context:\n\n${context}\n\n`) +
    `Fragment to repair:\n\n<<<${target}>>>`;
  try {
    const response = await registry.streamSimple(model, {
      systemPrompt: CORRECTION_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: request }], timestamp: Date.now() }],
    }, { signal, temperature: 0, samplingParams: { reasoning_effort: "none" } }).result();
    if (response.stopReason !== "stop" || signal?.aborted) return null;
    const fixed = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!fixed || !preservesCleanParagraphs(target, fixed)) return null;
    return fixed;
  } catch {
    return null;
  }
}

/** Uncorrupted paragraphs of the target must survive the fix verbatim - backstop against the corrector dropping content. */
export function preservesCleanParagraphs(target: string, fixed: string): boolean {
  const clean = (text: string) => text.replace(/\s+/g, " ").trim();
  const body = clean(fixed);
  return target.split(/\n{2,}/).every((p) => needsFix(p) || body.includes(clean(p)));
}

const CORRECTION_PROMPT = `The user message contains the full reply for context, then a fragment of it to repair between <<< and >>>. Both are corrupted the same way: CJK characters are injected into sentences written in other languages, Latin letters are swapped for Cyrillic look-alikes inside words (e.g. "poль" for "роль"), and grammar may be damaged by these flips.
Return the clean version of the fragment only: replace each injected CJK run with the word or short phrase the sentence intended, in the sentence's language, unless the CJK is obviously deliberate, like a citation or file path. Replace flipped letters with the correct letter of the word's script and repair the grammar.
Keep every paragraph of the fragment - do not drop, add, merge, or reorder them, and do not pull text in from the context. Grammar damaged by the flips should be repaired; everything else - Latin words, code, file paths, identifiers, numbers, punctuation, meaning, tone, and Markdown structure - stays exactly as it is. No commentary, code fences, quotes, or <<< >>> delimiters.`;
