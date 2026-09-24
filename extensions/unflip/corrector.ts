import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

const CORRECTOR_MODEL = "neuralwatt/deepseek-v4-flash";

export async function fixText(text: string, registry: ModelRegistry, signal?: AbortSignal): Promise<string | null> {
  const [provider, id] = CORRECTOR_MODEL.split("/");
  const model = provider && id ? registry.find(provider, id) : undefined;
  if (!model) return null;
  try {
    const response = await registry.streamSimple(model, {
      systemPrompt: CORRECTION_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text }], timestamp: Date.now() }],
    }, { signal, temperature: 0, samplingParams: { reasoning_effort: "none" } }).result();
    if (response.stopReason !== "stop" || signal?.aborted) return null;
    const fixed = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!fixed) return null;
    return fixed;
  } catch {
    return null;
  }
}

const CORRECTION_PROMPT = `The text below is corrupted: CJK characters are injected into sentences written in other languages, Latin letters are swapped for Cyrillic look-alikes inside words (e.g. "poль" for "роль"), and grammar may be damaged by these flips. Produce the clean version of the text in its original language.
Replace each injected CJK run with the word or short phrase the sentence obviously intended, in the sentence's language. Replace flipped letters with the correct letter of the word's script and repair the grammar. Keep the meaning, tone, and Markdown structure. Keep all Latin words, code, file paths, identifiers, numbers, and punctuation exactly as they are. Do not add commentary, code fences, or quotes. If the text has no corruption, return it unchanged.`;
