import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

const STEP = 2500;
const COLORS = { nwDefault: "#d62728", nwLowTemp: "#ff7f0e", synthetic: "#1f77b4", direct: "#2ca02c", other: "#9467bd" };

function colorFor(model: string, temperature: number | undefined): string {
  const provider = model.split("/")[0];
  if (provider === "neuralwatt") return temperature === undefined ? COLORS.nwDefault : COLORS.nwLowTemp;
  if (provider === "synthetic") return COLORS.synthetic;
  if (provider === "zai" || provider === "kimi-coding") return COLORS.direct;
  return COLORS.other;
}

interface RunHeader {
  type: string;
  model: string;
  language: string;
  temperature?: number;
}

interface Point {
  contextTokens: number | null;
  flip: boolean | null;
}

type Series = { x: number; y: number }[];

function main(): void {
  const args = process.argv.slice(2);
  const configPath = args.find((arg) => !arg.startsWith("--"));
  if (!configPath) throw new Error("Usage: node bench/plot.ts <config.json> [--model <substr,...>] [--language <substr,...>]");
  const models = filterArg(args, "--model");
  const languages = filterArg(args, "--language");
  const resultsDir = join(dirname(configPath), "results", basename(configPath, extname(configPath)));

  const slots = new Map<string, { label: string; model: string; temperature?: number; language: string; runs: Series[] }>();
  for (const file of readdirSync(resultsDir)) {
    if (!file.endsWith(".jsonl")) continue;
    const run = loadRun(join(resultsDir, file));
    if (!run) continue;
    const { model, language, temperature } = run.header;
    if (models.length && !matches(model, models)) continue;
    if (languages.length && !matches(language, languages)) continue;
    const label = `${model}${temperature === undefined ? "" : ` t${temperature}`} ${language}`;
    const slot = slots.get(label) ?? { label, model, temperature, language, runs: [] };
    slot.runs.push(cumulative(run.points));
    slots.set(label, slot);
  }
  if (!slots.size) throw new Error(`No runs matched in ${resultsDir}`);
  // A dash pattern per language, so both dimensions read off one chart.
  const languageNames = [...new Set([...slots.values()].map((slot) => slot.language))].sort();

  const grid: number[] = [];
  const xMax = Math.max(...[...slots.values()].flatMap((slot) => slot.runs.map((run) => run.at(-1)?.x ?? 0)));
  for (let x = STEP; x <= xMax; x += STEP) grid.push(x);

  const means = new Map<string, Series>();
  for (const [label, slot] of slots) means.set(label, grid.map((x) => ({ x, y: meanAt(slot.runs, x) })).filter(({ y }) => y !== null) as Series);
  // Scale to the tallest cumulative run, so the faint individual lines stay inside the axes.
  const yMax = Math.max(1, Math.ceil(Math.max(...[...slots.values()].flatMap((slot) => slot.runs.map((run) => run.at(-1)?.y ?? 0)))));

  for (const slot of slots.values()) {
    const turns = slot.runs.reduce((sum, run) => sum + run.length, 0);
    const flips = slot.runs.reduce((sum, run) => sum + (run.at(-1)?.y ?? 0), 0);
    const tokens = slot.runs.reduce((sum, run) => sum + (run.at(-1)?.x ?? 0), 0);
    console.log(`${slot.label}: ${slot.runs.length} runs, ${turns} turns, ${flips} flips, ${(flips / (tokens / 1000)).toFixed(2)} flips/1k tokens`);
  }

  const title = `accumulated problematic turns vs generated tokens${models.length ? `, models ${models.join("|")}` : ""}${languages.length ? `, languages ${languages.join("|")}` : ""}`;
  writeFileSync(
    `${resultsDir}.svg`,
    render([...slots.values()].map((slot) => ({ ...slot, mean: means.get(slot.label)! })), languageNames, xMax, yMax, title),
  );
  console.log(`\n${resultsDir}.svg`);
}

/** Value of a run's step function at x: the cumulative flip count of the last point at or before x, 0 before the first point. */
function valueAt(run: Series, x: number): number | undefined {
  if (run.length === 0 || run.at(-1)!.x < x) return undefined;
  let value = 0;
  for (const point of run) {
    if (point.x > x) break;
    value = point.y;
  }
  return value;
}

function meanAt(runs: Series[], x: number): number | null {
  const values = runs.map((run) => valueAt(run, x)).filter((value) => value !== undefined);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function cumulative(points: Point[]): Series {
  const series: Series = [];
  let flips = 0;
  for (const point of points) {
    if (point.contextTokens === null || point.flip === null) continue;
    if (point.flip) flips++;
    series.push({ x: point.contextTokens, y: flips });
  }
  return series;
}

function loadRun(path: string): { header: RunHeader; points: Point[] } | undefined {
  const lines = readFileSync(path, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const header = lines[0] as RunHeader;
  if (header?.type !== "run") return undefined;
  return { header, points: lines.slice(1) as Point[] };
}

function render(
  slots: { label: string; model: string; temperature?: number; language: string; runs: Series[]; mean: Series }[],
  languageNames: string[],
  xMax: number,
  yMax: number,
  title: string,
): string {
  const width = 900;
  const height = 620;
  const left = 80;
  const right = 300;
  const top = 50;
  const bottom = 60;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const sx = (x: number) => left + (x / xMax) * plotW;
  const sy = (y: number) => top + plotH - (y / yMax) * plotH;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="sans-serif">`];
  parts.push(`<rect width="${width}" height="${height}" fill="white"/>`, `<text x="${left}" y="28" font-size="15">${escape(title)}</text>`);

  const yStep = niceStep(yMax);
  for (let y = 0; y <= yMax; y += yStep) {
    parts.push(`<line x1="${left}" y1="${sy(y)}" x2="${left + plotW}" y2="${sy(y)}" stroke="#e5e5e5"/>`);
    parts.push(`<text x="${left - 8}" y="${sy(y) + 4}" font-size="12" text-anchor="end">${y}</text>`);
  }
  const xStep = niceStep(xMax);
  for (let x = 0; x <= xMax; x += xStep) {
    parts.push(`<line x1="${sx(x)}" y1="${top}" x2="${sx(x)}" y2="${top + plotH}" stroke="#e5e5e5"/>`);
    parts.push(`<text x="${sx(x)}" y="${top + plotH + 20}" font-size="12" text-anchor="middle">${Math.round(x / 1000)}k</text>`);
  }
  parts.push(`<text x="${left + plotW / 2}" y="${height - 12}" font-size="13" text-anchor="middle">generated tokens</text>`);
  parts.push(`<text x="20" y="${top + plotH / 2}" font-size="13" text-anchor="middle" transform="rotate(-90 20 ${top + plotH / 2})">accumulated problematic turns</text>`);

  slots.forEach((slot, index) => {
    const color = colorFor(slot.model, slot.temperature);
    const dash = languageNames.indexOf(slot.language) === 0 ? "" : languageNames.indexOf(slot.language) === 1 ? "7 5" : "2 4";
    for (const run of slot.runs) parts.push(path(run, sx, sy, color, 0.25, 1, dash));
    parts.push(path(slot.mean, sx, sy, color, 1, 2.5, dash));
    const y = top + 20 + index * 22;
    parts.push(`<line x1="${left + plotW + 30}" y1="${y}" x2="${left + plotW + 50}" y2="${y}" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash}"/>`);
    parts.push(`<text x="${left + plotW + 56}" y="${y + 4}" font-size="12">${escape(slot.label)}</text>`);
  });
  parts.push(`<text x="${left + plotW / 2}" y="${height - 34}" font-size="11" text-anchor="middle" fill="#777">bold: mean over runs, faint: individual runs, grid ${STEP} tokens</text>`);
  parts.push("</svg>");
  return parts.join("\n");
}

function path(points: Series, sx: (x: number) => number, sy: (y: number) => number, color: string, opacity: number, width: number, dash: string): string {
  if (points.length < 2) return "";
  const d = points.map((point, index) => `${index ? "L" : "M"}${sx(point.x).toFixed(1)} ${sy(point.y).toFixed(1)}`).join(" ");
  return `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-dasharray="${dash}"/>`;
}

function niceStep(range: number, target = 6): number {
  const magnitude = 10 ** Math.floor(Math.log10(range / target));
  return [1, 2, 5, 10].find((multiple) => multiple * magnitude >= range / target)! * magnitude;
}

function filterArg(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (const [index, arg] of args.entries()) {
    if (arg === flag && args[index + 1]) values.push(...args[index + 1].split(","));
  }
  return values;
}

const matches = (value: string, filters: string[]) => filters.some((filter) => value.includes(filter));
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

main();
