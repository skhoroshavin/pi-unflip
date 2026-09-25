import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentSession, CreateAgentSessionOptions } from "@earendil-works/pi-coding-agent";
import { mkdtempSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { needsFix } from "../extensions/unflip/detector.ts";

type ThinkingLevel = NonNullable<CreateAgentSessionOptions["thinkingLevel"]>;

const THINKING: readonly ThinkingLevel[] = ["off", "low", "medium", "high"];
const USAGE =
  "Usage: node bench/bench.ts --model <provider/id> --language <label> " +
  "[--target-tokens 100000] [--thinking high] [--max-turns 100] [--temperature <value>]";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: "string" },
      language: { type: "string" },
      "target-tokens": { type: "string", default: "100000" },
      thinking: { type: "string", default: "high" },
      "max-turns": { type: "string", default: "100" },
      temperature: { type: "string" },
    },
  });
  if (!values.model || !values.language) throw new Error(USAGE);
  if (!THINKING.includes(values.thinking as ThinkingLevel)) throw new Error(`Unknown thinking level: ${values.thinking}\n${USAGE}`);
  const thinking = values.thinking as ThinkingLevel;
  const targetTokens = numberArg(values["target-tokens"], "--target-tokens");
  const maxTurns = numberArg(values["max-turns"], "--max-turns");
  // Neutral cwd, so the project's own AGENTS.md stays out of the system prompt. Unique per run, so parallel runs don't collide.
  const runDir = mkdtempSync(join(tmpdir(), "pi-unflip-bench-"));
  const textFile = join(runDir, "text.txt");
  const temperature = values.temperature === undefined ? undefined : Number(values.temperature);

  const runtime = await ModelRuntime.create();

  const slash = values.model.indexOf("/");
  if (slash < 1) throw new Error(`Expected model as provider/id: ${values.model}`);
  const provider = values.model.slice(0, slash);
  const id = values.model.slice(slash + 1);
  const model = runtime.getModel(provider, id);
  if (!model) throw new Error(`Model not found: ${values.model}`);
  if (temperature !== undefined) model.samplingParams = { ...model.samplingParams, temperature };

  const { session } = await createAgentSession({
    model,
    modelRuntime: runtime,
    thinkingLevel: thinking,
    noTools: "all",
    sessionManager: SessionManager.inMemory(),
    // The plugin under test must not run inside the benchmark and correct the flips we are counting.
    resourceLoader: await loadResources(runDir),
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
      temperature,
      textFile,
    });

    for (let turn = 1; ; turn++) {
      try {
        await session.prompt(turn === 1 ? `Write five paragraphs in ${values.language} about a topic of your choice.` : "Continue.");
      } catch (error) {
        emit({ type: "point", turn, contextTokens: session.getContextUsage()?.tokens ?? null, flip: null, error: String(error) });
        break;
      }
      const contextTokens = session.getContextUsage()?.tokens ?? null;
      const blocks = detectorBlocks(session);
      const flip = blocks?.some(needsFix) ?? false;
      emit({ type: "point", turn, contextTokens, flip });
      if (blocks) await appendFile(textFile, section(turn, contextTokens, flip, blocks));
      if (contextTokens !== null && contextTokens >= targetTokens) break;
      if (turn >= maxTurns) break;
    }
  } finally {
    session.dispose();
  }
}

async function loadResources(cwd: string): Promise<DefaultResourceLoader> {
  const loader = new DefaultResourceLoader({ cwd, agentDir: getAgentDir(), noExtensions: true });
  await loader.reload();
  return loader;
}

/** Same gate as the plugin: final assistant message, stop reason, no tool calls. Returns the text blocks the detector would see. */
function detectorBlocks(session: AgentSession): string[] | undefined {
  const last = session.messages.at(-1);
  if (last?.role !== "assistant") return;
  if (last.stopReason !== "stop" || last.content.some((b) => b.type === "toolCall")) return;
  return last.content.filter((b) => b.type === "text").map((b) => b.text);
}

function section(turn: number, contextTokens: number | null, flip: boolean, blocks: string[]): string {
  const head = `=== turn ${turn} contextTokens=${contextTokens} flip=${flip} ===\n`;
  return head + blocks.map((text, index) => `--- block ${index} ---\n${text}\n`).join("");
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
