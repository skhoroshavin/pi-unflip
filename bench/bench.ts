import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentSession, CreateAgentSessionOptions } from "@earendil-works/pi-coding-agent";
import { parseArgs } from "node:util";
import { needsFix } from "../extensions/unflip/detector.ts";

type ThinkingLevel = NonNullable<CreateAgentSessionOptions["thinkingLevel"]>;

const THINKING: readonly ThinkingLevel[] = ["off", "low", "medium", "high"];
const USAGE =
  "Usage: node bench/bench.ts --model <provider/id> --language <label> " +
  "[--target-tokens 100000] [--thinking high] [--max-turns 100]";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: "string" },
      language: { type: "string" },
      "target-tokens": { type: "string", default: "100000" },
      thinking: { type: "string", default: "high" },
      "max-turns": { type: "string", default: "100" },
    },
  });
  if (!values.model || !values.language) throw new Error(USAGE);
  if (!THINKING.includes(values.thinking as ThinkingLevel)) throw new Error(`Unknown thinking level: ${values.thinking}\n${USAGE}`);
  const thinking = values.thinking as ThinkingLevel;
  const targetTokens = numberArg(values["target-tokens"], "--target-tokens");
  const maxTurns = numberArg(values["max-turns"], "--max-turns");

  const runtime = await ModelRuntime.create();

  const slash = values.model.indexOf("/");
  if (slash < 1) throw new Error(`Expected model as provider/id: ${values.model}`);
  const provider = values.model.slice(0, slash);
  const id = values.model.slice(slash + 1);
  const model = runtime.getModel(provider, id);
  if (!model) throw new Error(`Model not found: ${values.model}`);

  const { session } = await createAgentSession({
    model,
    modelRuntime: runtime,
    thinkingLevel: thinking,
    noTools: "all",
    sessionManager: SessionManager.inMemory(),
    // The plugin under test must not run inside the benchmark and correct the flips we are counting.
    resourceLoader: await loadResources(),
  });
  session.setAutoCompactionEnabled(false);

  try {
    emit({
      type: "run",
      model: values.model,
      provider,
      language: values.language,
      targetTokens,
      contextWindow: model.contextWindow,
      thinking,
    });

    for (let turn = 1; ; turn++) {
      try {
        await session.prompt(turn === 1 ? `Write two paragraphs in ${values.language}.` : "Another two.");
      } catch (error) {
        emit({ type: "point", turn, contextTokens: session.getContextUsage()?.tokens ?? null, flip: null, error: String(error) });
        break;
      }
      const contextTokens = session.getContextUsage()?.tokens ?? null;
      emit({ type: "point", turn, contextTokens, flip: flipOf(session) });
      if (contextTokens !== null && contextTokens >= targetTokens) break;
      if (turn >= maxTurns) break;
    }
  } finally {
    session.dispose();
  }
}

async function loadResources(): Promise<DefaultResourceLoader> {
  const loader = new DefaultResourceLoader({ cwd: process.cwd(), agentDir: getAgentDir(), noExtensions: true });
  await loader.reload();
  return loader;
}

/** Same gate as the plugin: final assistant message, stop reason, no tool calls, text blocks only. */
function flipOf(session: AgentSession): boolean | null {
  const last = session.messages.at(-1);
  if (last?.role !== "assistant") return null;
  if (last.stopReason !== "stop" || last.content.some((b) => b.type === "toolCall")) return null;
  return last.content.some((b) => b.type === "text" && needsFix(b.text));
}

function emit(record: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

function numberArg(raw: string | undefined, flag: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`Invalid ${flag}: ${raw}`);
  return value;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
