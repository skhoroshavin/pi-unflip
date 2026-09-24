import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fixText } from "./corrector.ts";
import { needsFix } from "./detector.ts";

export default function (pi: ExtensionAPI) {
  pi.on("message_end", async (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant" || message.stopReason !== "stop") return;
    let text = "";
    for (const block of message.content) {
      if (block.type === "toolCall") return;
      if (block.type === "text") text += block.text;
    }
    if (!needsFix(text)) return;

    ctx.ui.notify("Fixing corrupted text...");
    const content = [...message.content];
    let changed = false;
    for (let i = 0; i < content.length; i++) {
      const block = content[i];
      if (block.type !== "text" || !block.text) continue;
      const fixed = await fixText(block.text, ctx.modelRegistry, ctx.signal);
      if (fixed === null) {
        ctx.ui.notify("Correction failed, keeping original");
        return;
      }
      if (fixed !== block.text) {
        content[i] = { type: "text", text: fixed };
        changed = true;
      }
    }
    if (!changed) {
      ctx.ui.notify("Nothing to fix");
      return;
    }
    ctx.ui.notify("Corrupted text fixed");
    return { message: { ...message, content } };
  });
}
