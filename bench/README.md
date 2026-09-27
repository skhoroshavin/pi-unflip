# Benchmark

Measures how often a model corrupts its own prose, using the detector in `extensions/unflip/detector.ts` as the judge: each session writes five paragraphs in one language, then gets told to continue until the context reaches `targetTokens`, and every turn the detector flags counts as a flip. Three runs per model and language, because a single run says very little.

## Scripts

- `bench.ts` runs one session and writes one JSONL line per turn to stdout: turn number, context tokens, whether the detector fired. The session has no tools and no compaction, runs in a temp directory of its own (which keeps this repo's AGENTS.md out of the system prompt) and dumps every text block the detector saw into `text.txt` there.
- `orchestrate.ts` walks an experiment: reads `<dir>/config.json`, runs models x languages x rounds one after another, skips combinations whose `.jsonl` already exists, and writes each run through a `.part` file that is renamed only when the run finished cleanly.
- `plot.ts` draws `<dir>.svg`: one line per model, temperature and language, averaged over that combination's runs, with colour for the provider and temperature and a dashed line for the second language.

## Running

```bash
node bench/orchestrate.ts bench/results/glm-5.3   # reads bench/results/glm-5.3/config.json
node bench/plot.ts        bench/results/glm-5.3   # writes bench/results/glm-5.3.svg
```

A config lists the models (each with an optional `temperature`) and the languages, plus optional `targetTokens`, `rounds`, `thinking` and `maxTurns`:

```json
{
  "targetTokens": 50000,
  "models": [{ "model": "neuralwatt/glm-5.3-flash" }, { "model": "zai/glm-5.3-flash", "temperature": 0.9 }],
  "languages": ["English", "Russian"]
}
```

Rerunning the same command resumes: finished combinations are skipped. A run that fails, meaning a provider error or a turn that does not finish normally, is discarded and stops the batch. The generated text stays in the temp directory of its own run; the config, the JSONL and the rendered chart are what get committed.

## Results layout

Every experiment directory holds its own `config.json` next to the runs it produced, so the data explains itself. `bench/archive/results/` keeps the runs from before neuralwatt fixed their sampling defaults, kept apart so they can never be averaged into the current ones.
