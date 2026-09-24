import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

const CORRECTOR_MODEL = "neuralwatt/deepseek-v4-flash";

const CORRECTION_PROMPT = `The text below may contain encoding corruption: CJK characters injected into sentences, Latin letters swapped for Cyrillic look-alikes (or vice versa), and grammar slips caused by such flips. Rewrite it as clean text in the same language.
Keep the meaning, tone, and Markdown structure. Keep all Latin words, code, file paths, identifiers, numbers, and punctuation exactly as they are. Do not add commentary, code fences, or quotes around the answer. If the text is already clean, return it unchanged.`;

export async function fixText(text: string, registry: ModelRegistry, signal?: AbortSignal): Promise<string | null> {
  const [provider, id] = CORRECTOR_MODEL.split("/");
  const model = provider && id ? registry.find(provider, id) : undefined;
  if (!model) return null;
  try {
    // deepseek-v4-flash has thinking disabled server-side (default_effort "none"), so no reasoning option
    const response = await registry.streamSimple(model, {
      systemPrompt: CORRECTION_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text }], timestamp: Date.now() }],
    }, { signal }).result();
    if (response.stopReason !== "stop" || signal?.aborted) return null;
    const fixed = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!fixed) return null;
    return fixed;
  } catch {
    return null;
  }
}
