import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const ROUNDS = 3;

interface Config {
  models: { model: string; temperature?: number }[];
  languages: string[];
}

async function main(): Promise<void> {
  const [configPath, ...forwarded] = process.argv.slice(2);
  if (!configPath) throw new Error("Usage: node bench/orchestrate.ts <config.json> [bench args...]");
  const config: Config = JSON.parse(await readFile(configPath, "utf8"));
  // Results live next to the config under its own name, so rerunning the same config resumes instead of restarting.
  const outDir = join(dirname(configPath), "results", basename(configPath, extname(configPath)));
  mkdirSync(outDir, { recursive: true });
  const total = config.models.length * config.languages.length * ROUNDS;
  let index = 0;
  for (const { model, temperature } of config.models) {
    for (const language of config.languages) {
      for (let round = 1; round <= ROUNDS; round++) {
        index++;
        const label = `${slug(model)}${temperature === undefined ? "" : `-t${temperature}`}-${slug(language)}-${round}`;
        const out = join(outDir, `${label}.jsonl`);
        if (existsSync(out)) {
          console.error(`[${index}/${total}] skip ${label}`);
          continue;
        }
        console.error(`[${index}/${total}] run ${label}`);
        await run(fullArgs(model, temperature, language, forwarded), out);
      }
    }
  }
}

function fullArgs(model: string, temperature: number | undefined, language: string, forwarded: string[]): string[] {
  const bench = [join(import.meta.dirname, "bench.ts"), "--model", model, "--language", language];
  if (temperature !== undefined) bench.push("--temperature", String(temperature));
  return [...bench, ...forwarded];
}

async function run(args: string[], out: string): Promise<void> {
  const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "inherit"] });
  const closed = once(child, "close");
  await pipeline(child.stdout, createWriteStream(out));
  const [code] = await closed;
  if (code !== 0) {
    await unlink(out);
    throw new Error(`bench exited with ${code}: ${args.slice(1).join(" ")}`);
  }
}

const slug = (text: string) => text.replace(/[/\s]+/g, "-");

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
