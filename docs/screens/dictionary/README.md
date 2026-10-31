# Dictionary and translation screenshots

Captured by `tests/e2e/dictionary.spec.ts` (Playwright).

| File | Description |
|---|---|
| `settings-packs.png` | Settings: optional packs with sizes and licences |
| `pack-installed.png` | After downloading the WordNet core pack |

## Pack sizes (gzip over the wire, approximate)

| Pack | Size (declared) | License |
|---|---|---|
| `wordnet-en-core.json` | ~48 KB | WordNet License |
| `translate-en-hi-lexicon.json` | ~36 KB | CC BY-SA 4.0 sample + MPL-2.0 (Bergamot runtime when used) |
| `translate-en-es-lexicon.json` | ~35 KB | CC BY-SA 4.0 sample |

## Lookup latency

After packs are on device, synchronous WordNet lookup in the lexicon map is sub-millisecond; the popup is shown on the next frame (target **&lt;100 ms** p95 in QA).
