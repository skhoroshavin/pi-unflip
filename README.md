# pi-unflip

Fixes corrupted prose in coding-agent responses. Some providers return text with CJK characters glued into sentences ("The migration ran clean, 报告 and the index is rebuilt") and Latin letters swapped for Cyrillic look-alikes ("The сache is warm"); unflip detects this locally and, when a response looks corrupted, asks a corrector model to fix it. The corrected version replaces the original on screen and in the session itself.

## Install

```bash
pi install npm:pi-unflip
```

## License

MIT. See [LICENSE](./LICENSE).
