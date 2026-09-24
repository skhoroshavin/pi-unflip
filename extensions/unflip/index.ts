import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { fixText } from "./corrector.ts";
import { needsFix } from "./detector.ts";

const STATUS_KEY = "unflip";
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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

    ctx.ui.notify("unflip: fixing corrupted text", "warning");
    const stopSpinner = startSpinner(ctx);
    try {
      const content = [...message.content];
      let changed = false;
      for (let i = 0; i < content.length; i++) {
        const block = content[i];
        if (block.type !== "text") continue;
        const fixed = await fixText(block.text, ctx.modelRegistry, ctx.signal);
        if (fixed === null) {
          ctx.ui.notify("unflip: correction failed, keeping original", "warning");
          return;
        }
        if (fixed !== block.text) {
          content[i] = { type: "text", text: fixed };
          changed = true;
        }
      }
      if (changed) return { message: { ...message, content } };
    } finally {
      stopSpinner();
    }
  });
}

function startSpinner(ctx: ExtensionContext): () => void {
  if (!ctx.hasUI) return () => {};
  let frame = 0;
  const render = () => ctx.ui.setStatus(STATUS_KEY, `${SPINNER_FRAMES[frame++ % SPINNER_FRAMES.length]} unflip: fixing`);
  render();
  const timer = setInterval(render, 120);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    ctx.ui.setStatus(STATUS_KEY, undefined);
  };
}
