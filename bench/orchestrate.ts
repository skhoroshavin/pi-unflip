import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const DEFAULT_ROUNDS = 3;

interface Config {
  targetTokens?: number;
  thinking?: string;
  maxTurns?: number;
  rounds?: number;
  models: { model: string; temperature?: number }[];
  languages: string[];
}

async function main(): Promise<void> {
  const [configPath, ...rest] = process.argv.slice(2);
  if (!configPath || rest.length) throw new Error("Usage: node bench/orchestrate.ts <config.json>");
  const config: Config = JSON.parse(await readFile(configPath, "utf8"));
  if (!config.models?.length || !config.languages?.length) throw new Error("config needs non-empty models and languages");
  const combos = config.models.flatMap(({ model, temperature }) =>
    config.languages.map((language) => ({ model, temperature, language, label: comboLabel(model, temperature, language) })),
  );
  const duplicate = combos.map(({ label }) => label).find((label, index, labels) => labels.indexOf(label) !== index);
  if (duplicate) throw new Error(`Combinations share the label ${duplicate}`);
  // Results live next to the config under its own name, so rerunning the same config resumes instead of restarting.
  const outDir = join(dirname(configPath), "results", basename(configPath, extname(configPath)));
  mkdirSync(outDir, { recursive: true });
  const rounds = config.rounds ?? DEFAULT_ROUNDS;
  const total = combos.length * rounds;
  let index = 0;
  for (const { model, temperature, language, label } of combos) {
    for (let round = 1; round <= rounds; round++) {
      index++;
      const out = join(outDir, `${label}-${round}.jsonl`);
      if (existsSync(out)) {
        console.error(`[${index}/${total}] skip ${label}-${round}`);
        continue;
      }
      console.error(`[${index}/${total}] run ${label}-${round}`);
      await run(benchArgs(config, model, temperature, language), out);
    }
  }
}

function benchArgs(config: Config, model: string, temperature: number | undefined, language: string): string[] {
  const args = [join(import.meta.dirname, "bench.ts"), "--model", model, "--language", language];
  if (temperature !== undefined) args.push("--temperature", String(temperature));
  if (config.targetTokens !== undefined) args.push("--target-tokens", String(config.targetTokens));
  if (config.thinking !== undefined) args.push("--thinking", config.thinking);
  if (config.maxTurns !== undefined) args.push("--max-turns", String(config.maxTurns));
  return args;
}

async function run(args: string[], out: string): Promise<void> {
  // Stream through a .part file so a killed run can never be mistaken for a completed one by the skip check.
  const part = `${out}.part`;
  const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "inherit"] });
  const closed = once(child, "close");
  await pipeline(child.stdout, createWriteStream(part));
  const [code] = await closed;
  if (code !== 0) {
    await unlink(part);
    throw new Error(`bench exited with ${code}: ${args.slice(1).join(" ")}`);
  }
  await rename(part, out);
}

const slug = (text: string) => text.replace(/[/\s]+/g, "-");

const comboLabel = (model: string, temperature: number | undefined, language: string) =>
  `${slug(model)}${temperature === undefined ? "" : `-t${temperature}`}-${slug(language)}`;

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
