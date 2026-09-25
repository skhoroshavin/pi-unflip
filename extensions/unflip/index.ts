import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fixText } from "./corrector.ts";
import { needsFix } from "./detector.ts";

export default function (pi: ExtensionAPI) {
  pi.on("message_end", async (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant" || message.stopReason !== "stop") return;
    if (message.content.some((b) => b.type === "toolCall")) return;

    let started = false;
    let changed = false;
    const content = [...message.content];
    for (let i = 0; i < content.length; i++) {
      const block = content[i];
      if (block.type !== "text" || !needsFix(block.text)) continue;
      if (!started) {
        ctx.ui.notify("Fixing corrupted text...");
        started = true;
      }
      const fixed = await fixText(block.text, ctx.modelRegistry, ctx.signal);
      if (fixed === null) {
        ctx.ui.notify("Correction failed, keeping original");
        continue;
      }
      if (fixed !== block.text) {
        content[i] = { type: "text", text: fixed };
        changed = true;
      }
    }
    if (!started) return;
    ctx.ui.notify("Corrupted text fixed");
    if (changed) return { message: { ...message, content } };
  });
}
