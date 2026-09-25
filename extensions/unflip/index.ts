import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fixText } from "./corrector.ts";
import { needsFix } from "./detector.ts";

export default function (pi: ExtensionAPI) {
  pi.on("message_end", async (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant" || message.stopReason !== "stop") return;
    if (message.content.some((b) => b.type === "toolCall")) return;

    const content = [...message.content];
    const blocks: { index: number; text: string }[] = [];
    for (const [index, block] of content.entries()) {
      if (block.type === "text") blocks.push({ index, text: block.text });
    }
    const targets = blocks.filter((b) => needsFix(b.text));
    if (!targets.length) return;

    ctx.ui.notify("Fixing corrupted text...");
    const context = blocks.map((b) => b.text).join("\n\n");
    let changed = false;
    for (const { index, text } of targets) {
      const fixed = await fixText(text, context, ctx.modelRegistry, ctx.signal);
      if (fixed === null) {
        ctx.ui.notify("Correction failed, keeping original");
        continue;
      }
      if (fixed !== text) {
        content[index] = { type: "text", text: fixed };
        changed = true;
      }
    }
    ctx.ui.notify("Corrupted text fixed");
    if (changed) return { message: { ...message, content } };
  });
}
