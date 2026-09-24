import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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
    if (needsFix(text)) {
      ctx.ui.notify("unflip: corrupted text detected", "warning");
    }
  });
}
