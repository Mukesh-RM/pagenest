// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { parseCmudict } from './cmu-dict';
import { englishTextToPhonemeIds, g2pMappingCoverage } from './english-g2p';
import { G2P_EVAL_SENTENCES } from './g2p-eval-sentences';
import { huggingFaceOnnxJsonUrl, NARRATION_SMOKE_VOICE_ID } from '../piper/approved-voices';
import { parsePiperVoiceConfig } from '../piper/piper-voice-config';

let voiceConfig: ReturnType<typeof parsePiperVoiceConfig>;
let dict: ReturnType<typeof parseCmudict>;

beforeAll(async () => {
  const [cfgResp, dictResp] = await Promise.all([
    fetch(huggingFaceOnnxJsonUrl(NARRATION_SMOKE_VOICE_ID)),
    fetch('https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict'),
  ]);
  voiceConfig = parsePiperVoiceConfig(await cfgResp.text());
  dict = parseCmudict(await dictResp.text());
}, 60_000);

describe('G2P quality (50 sentences)', () => {
  it('reports OOV rate and phoneme map coverage', () => {
    let totalWords = 0;
    let oovWords = 0;
    let coveredSymbols = 0;
    let totalSymbols = 0;
    const missingSymbols = new Set<string>();

    for (const sentence of G2P_EVAL_SENTENCES) {
      const result = englishTextToPhonemeIds(sentence, { dict, voiceConfig });
      totalWords += result.dictHits + result.dictMisses;
      oovWords += result.oovWords.length;
      for (const sym of result.unknownSymbols) {
        missingSymbols.add(sym);
      }
      const cov = g2pMappingCoverage(result.phonemeString, voiceConfig);
      coveredSymbols += cov.covered;
      totalSymbols += cov.total;
    }

    const oovRate = totalWords > 0 ? oovWords / totalWords : 0;
    const mapCoverage = totalSymbols > 0 ? coveredSymbols / totalSymbols : 0;

    // Logged for docs/NARRATION_PIPER.md (objective gate in CI).
    console.info(
      JSON.stringify({
        sentences: G2P_EVAL_SENTENCES.length,
        totalWords,
        oovWords,
        oovRate: Number(oovRate.toFixed(4)),
        mapCoverage: Number(mapCoverage.toFixed(4)),
        missingSymbolCount: missingSymbols.size,
      }),
    );

    expect(mapCoverage).toBeGreaterThan(0.99);
    expect(missingSymbols.size).toBe(0);
    expect(oovRate).toBeLessThan(0.35);
  });
});
