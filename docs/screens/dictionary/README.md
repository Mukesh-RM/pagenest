# Dictionary and translation screenshots

Captured by `tests/e2e/dictionary.spec.ts` (Playwright). E2E builds use `VITE_PN_MOCK_DICTIONARY=1` and `VITE_PN_MOCK_BERGAMOT=1` so packs install quickly; production uses full WordNet WNPK and Bergamot WASM downloads.

| File | Description |
|---|---|
| `settings-packs.png` | Settings: optional packs with sizes and licences |
| `pack-installed.png` | After downloading the WordNet starter pack |
| `reader-define-popup.png` | Reader Define popup (capture when foliate selection e2e is stable) |
| `reader-translate-sentence.png` | Reader Translate on a sentence (capture when foliate selection e2e is stable) |

## Pack sizes (declared in Settings, approximate)

| Pack | Size (declared) | License |
|---|---|---|
| `wordnet-en-full.wnpk.gz` | ~6.9 MB gzip | WordNet License |
| `wordnet-en-core.json` | ~48 KB | WordNet License |
| `translate-en-hi-lexicon.json` | ~36 KB | CC BY-SA 4.0 sample (no public en↔hi WASM model) |
| `translate-en-es` (+ Bergamot enes/esen) | ~43 MB | MPL-2.0 + CC-BY models + lexicon fallback |
| Other `translate-en-*` pairs | ~43–74 MB | MPL-2.0 + CC-BY (Mozilla S3 registry) |

## Lookup latency

After the full WordNet WNPK pack is on device, the index is parsed once; each lemma lookup is a binary search (target **under 100 ms**, typically sub-millisecond). The popup renders on the next frame.
