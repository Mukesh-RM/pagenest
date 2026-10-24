/**
 * Top heteronyms with light context disambiguation (MIT, hand-authored).
 */

export interface HeteronymEntry {
  readonly phones: readonly string[];
  /** If any pattern matches the surrounding context, use these phones. */
  readonly when?: readonly { readonly pattern: RegExp; readonly phones: readonly string[] }[];
}

export const HETERONYM_LEXICON: Readonly<Record<string, HeteronymEntry>> = {
  read: {
    phones: ['R', 'EH1', 'D'],
    when: [
      { pattern: /\b(read|reads)\b[^.]{0,40}\b(yesterday|ago|last)\b/i, phones: ['R', 'EH1', 'D'] },
      { pattern: /\b(will|to|please|can|must|should|might|going)\s+read\b/i, phones: ['R', 'IY1', 'D'] },
      { pattern: /\bhas\s+read\b/i, phones: ['R', 'EH1', 'D'] },
      { pattern: /\b(read|reads)\s+(the|a|an|this|that|my|your)\b/i, phones: ['R', 'IY1', 'D'] },
    ],
  },
  lead: {
    phones: ['L', 'EH1', 'D'],
    when: [{ pattern: /\bwill\s+lead\b|\blead\s+the\b|\bleads\b/i, phones: ['L', 'IY1', 'D'] }],
  },
  live: {
    phones: ['L', 'IH1', 'V'],
    when: [{ pattern: /\blive\s+(in|on|at|with)\b|\blives\b/i, phones: ['L', 'AY1', 'V'] }],
  },
  wind: {
    phones: ['W', 'IH1', 'N', 'D'],
    when: [{ pattern: /\bwind\s+(the|up|down)\b|\bwind\s+your\b/i, phones: ['W', 'AY1', 'N', 'D'] }],
  },
  tear: {
    phones: ['T', 'EH1', 'R'],
    when: [{ pattern: /\btear\s+(up|down|off)\b|\btears\b/i, phones: ['T', 'EH1', 'R'] }],
  },
  bass: {
    phones: ['B', 'AE1', 'S'],
    when: [{ pattern: /\bbass\s+(guitar|player|line)\b/i, phones: ['B', 'EY1', 'S'] }],
  },
  bow: {
    phones: ['B', 'OW1'],
    when: [
      { pattern: /\bbow\s+(and\s+arrow|tie)\b/i, phones: ['B', 'OW1'] },
      { pattern: /\btake\s+a\s+bow\b/i, phones: ['B', 'AW1'] },
    ],
  },
  close: {
    phones: ['K', 'L', 'OW1', 'S'],
    when: [{ pattern: /\bclose\s+(to|by)\b|\bclose\s+the\b/i, phones: ['K', 'L', 'OW1', 'Z'] }],
  },
  use: {
    phones: ['Y', 'UW1', 'S'],
    when: [{ pattern: /\bused\s+to\b|\buse\s+(the|a|an|this)\b/i, phones: ['Y', 'UW1', 'Z'] }],
  },
  row: {
    phones: ['R', 'OW1'],
    when: [{ pattern: /\brow\s+(a|the)\s+boat\b|\browing\b/i, phones: ['R', 'AW1'] }],
  },
  wound: {
    phones: ['W', 'AW1', 'N', 'D'],
    when: [{ pattern: /\bwound\s+(up|the)\b|\bwounded\b/i, phones: ['W', 'UW1', 'N', 'D'] }],
  },
  sow: {
    phones: ['S', 'OW1'],
    when: [{ pattern: /\bsow\s+seeds\b/i, phones: ['S', 'AW1'] }],
  },
  minute: {
    phones: ['M', 'IH1', 'N', 'AH0', 'T'],
    when: [{ pattern: /\bminute\s+(detail|difference)\b/i, phones: ['M', 'AY0', 'N', 'UW1', 'T'] }],
  },
  record: {
    phones: ['R', 'EH1', 'K', 'ER0', 'D'],
    when: [{ pattern: /\brecord\s+(the|a|an)\b/i, phones: ['R', 'IH0', 'K', 'AO1', 'R', 'D'] }],
  },
  present: {
    phones: ['P', 'R', 'EH1', 'Z', 'AH0', 'N', 'T'],
    when: [{ pattern: /\bpresent\s+(the|a|gift)\b/i, phones: ['P', 'R', 'EH1', 'S', 'AH0', 'N', 'T'] }],
  },
  refuse: {
    phones: ['R', 'IH0', 'F', 'Y', 'UW1', 'Z'],
    when: [{ pattern: /\brefuse\s+(bin|heap)\b/i, phones: ['R', 'EH1', 'F', 'Y', 'UW0', 'S'] }],
  },
  desert: {
    phones: ['D', 'EH1', 'Z', 'ER0', 'T'],
    when: [{ pattern: /\bdesert\s+(the|his|her)\b/i, phones: ['D', 'IH0', 'Z', 'ER1', 'T'] }],
  },
  produce: {
    phones: ['P', 'R', 'AH0', 'D', 'UW1', 'S'],
    when: [{ pattern: /\bproduce\s+(section|aisle)\b/i, phones: ['P', 'R', 'OW1', 'D', 'UW0', 'S'] }],
  },
  object: {
    phones: ['AH0', 'B', 'JH', 'EH1', 'K', 'T'],
    when: [{ pattern: /\bobject\s+to\b/i, phones: ['AH0', 'B', 'JH', 'EH1', 'K', 'T'] }],
  },
  subject: {
    phones: ['S', 'AH1', 'B', 'JH', 'IH0', 'K', 'T'],
    when: [{ pattern: /\bsubject\s+(to|them)\b/i, phones: ['S', 'AH0', 'B', 'JH', 'EH1', 'K', 'T'] }],
  },
  combine: {
    phones: ['K', 'AH0', 'M', 'B', 'AY1', 'N'],
    when: [{ pattern: /\bcombine\s+(harvester)\b/i, phones: ['K', 'AA1', 'M', 'B', 'AY0', 'N'] }],
  },
  conflict: {
    phones: ['K', 'AA1', 'N', 'F', 'L', 'IH0', 'K', 'T'],
    when: [{ pattern: /\bconflict\s+with\b/i, phones: ['K', 'AH0', 'N', 'F', 'L', 'IH1', 'K', 'T'] }],
  },
  convert: {
    phones: ['K', 'AH0', 'N', 'V', 'ER1', 'T'],
    when: [{ pattern: /\bconvert\s+(the|a)\b/i, phones: ['K', 'AH0', 'N', 'V', 'ER1', 'T'] }],
  },
  excuse: {
    phones: ['IH0', 'K', 'S', 'K', 'Y', 'UW1', 'S'],
    when: [{ pattern: /\bno\s+excuse\b/i, phones: ['IH0', 'K', 'S', 'K', 'Y', 'UW1', 'S'] }],
  },
  export: {
    phones: ['EH1', 'K', 'S', 'P', 'AO0', 'R', 'T'],
    when: [{ pattern: /\bexport\s+(the|data)\b/i, phones: ['IH0', 'K', 'S', 'P', 'AO1', 'R', 'T'] }],
  },
  import: {
    phones: ['IH1', 'M', 'P', 'AO0', 'R', 'T'],
    when: [{ pattern: /\bimport\s+(the|a)\b/i, phones: ['IH0', 'M', 'P', 'AO1', 'R', 'T'] }],
  },
  increase: {
    phones: ['IH0', 'N', 'K', 'R', 'IY1', 'S'],
    when: [{ pattern: /\bincrease\s+(the|sales)\b/i, phones: ['IH0', 'N', 'K', 'R', 'IY1', 'S'] }],
  },
  decrease: {
    phones: ['D', 'IH0', 'K', 'R', 'IY1', 'S'],
    when: [{ pattern: /\bdecrease\s+(the)\b/i, phones: ['D', 'IH0', 'K', 'R', 'IY1', 'S'] }],
  },
  advocate: {
    phones: ['AE1', 'D', 'V', 'AH0', 'K', 'AH0', 'T'],
    when: [{ pattern: /\badvocate\s+for\b/i, phones: ['AE1', 'D', 'V', 'AH0', 'K', 'EY2', 'T'] }],
  },
  aggregate: {
    phones: ['AE1', 'G', 'R', 'AH0', 'G', 'AH0', 'T'],
    when: [{ pattern: /\baggregate\s+demand\b/i, phones: ['AE1', 'G', 'R', 'IH0', 'G', 'EY2', 'T'] }],
  },
  attribute: {
    phones: ['AH0', 'T', 'R', 'IH1', 'B', 'Y', 'UW0', 'T'],
    when: [{ pattern: /\battribute\s+to\b/i, phones: ['AE1', 'T', 'R', 'AH0', 'B', 'Y', 'UW0', 'T'] }],
  },
  perfect: {
    phones: ['P', 'ER1', 'F', 'IH0', 'K', 'T'],
    when: [{ pattern: /\bperfect\s+(the|your)\b/i, phones: ['P', 'ER0', 'F', 'EH1', 'K', 'T'] }],
  },
  permit: {
    phones: ['P', 'ER0', 'M', 'IH1', 'T'],
    when: [{ pattern: /\bpermit\s+(the|a)\b/i, phones: ['P', 'ER1', 'M', 'IH0', 'T'] }],
  },
  progress: {
    phones: ['P', 'R', 'AA1', 'G', 'R', 'EH0', 'S'],
    when: [{ pattern: /\bprogress\s+(the|bar)\b/i, phones: ['P', 'R', 'AH0', 'G', 'R', 'EH1', 'S'] }],
  },
  rebel: {
    phones: ['R', 'EH1', 'B', 'AH0', 'L'],
    when: [{ pattern: /\brebel\s+against\b/i, phones: ['R', 'IH0', 'B', 'EH1', 'L'] }],
  },
  resume: {
    phones: ['R', 'IH0', 'Z', 'UW1', 'M'],
    when: [{ pattern: /\bresume\s+(the|your)\b/i, phones: ['R', 'EH1', 'Z', 'AH0', 'M', 'EY2'] }],
  },
  separate: {
    phones: ['S', 'EH1', 'P', 'R', 'AH0', 'T'],
    when: [{ pattern: /\bseparate\s+(the|into)\b/i, phones: ['S', 'EH1', 'P', 'AH0', 'R', 'EY2', 'T'] }],
  },
  survey: {
    phones: ['S', 'ER0', 'V', 'EY1'],
    when: [{ pattern: /\bsurvey\s+(the|said)\b/i, phones: ['S', 'AH0', 'V', 'EY1', 'R'] }],
  },
  transfer: {
    phones: ['T', 'R', 'AE0', 'N', 'S', 'F', 'ER1'],
    when: [{ pattern: /\btransfer\s+(the|to)\b/i, phones: ['T', 'R', 'AE0', 'N', 'S', 'F', 'ER1'] }],
  },
  contrast: {
    phones: ['K', 'AA1', 'N', 'T', 'R', 'AE0', 'S', 'T'],
    when: [{ pattern: /\bcontrast\s+with\b/i, phones: ['K', 'AH0', 'N', 'T', 'R', 'AE1', 'S', 'T'] }],
  },
  contract: {
    phones: ['K', 'AA1', 'N', 'T', 'R', 'AE0', 'K', 'T'],
    when: [{ pattern: /\bcontract\s+(with)\b/i, phones: ['K', 'AH0', 'N', 'T', 'R', 'AE1', 'K', 'T'] }],
  },
  digest: {
    phones: ['D', 'AY0', 'JH', 'EH1', 'S', 'T'],
    when: [{ pattern: /\bdigest\s+(the|food)\b/i, phones: ['D', 'AY0', 'JH', 'EH1', 'S', 'T'] }],
  },
  insult: {
    phones: ['IH0', 'N', 'S', 'AH1', 'L', 'T'],
    when: [{ pattern: /\binsult\s+(to)\b/i, phones: ['IH0', 'N', 'S', 'AH1', 'L', 'T'] }],
  },
  protest: {
    phones: ['P', 'R', 'OW1', 'T', 'EH2', 'S', 'T'],
    when: [{ pattern: /\bprotest\s+(the|against)\b/i, phones: ['P', 'R', 'AH0', 'T', 'EH1', 'S', 'T'] }],
  },
  reject: {
    phones: ['R', 'IH0', 'JH', 'EH1', 'K', 'T'],
    when: [{ pattern: /\breject\s+(the)\b/i, phones: ['R', 'IH0', 'JH', 'EH1', 'K', 'T'] }],
  },
  suspect: {
    phones: ['S', 'AH0', 'S', 'P', 'EH1', 'K', 'T'],
    when: [{ pattern: /\bsuspect\s+(the|a)\b/i, phones: ['S', 'AH0', 'S', 'P', 'EH1', 'K', 'T'] }],
  },
  conduct: {
    phones: ['K', 'AH0', 'N', 'D', 'AH1', 'K', 'T'],
    when: [{ pattern: /\bconduct\s+(the|an)\b/i, phones: ['K', 'AH0', 'N', 'D', 'AH1', 'K', 'T'] }],
  },
  content: {
    phones: ['K', 'AA1', 'N', 'T', 'EH0', 'N', 'T'],
    when: [{ pattern: /\bcontent\s+(with)\b/i, phones: ['K', 'AH0', 'N', 'T', 'EH1', 'N', 'T'] }],
  },
  entrance: {
    phones: ['EH1', 'N', 'T', 'R', 'AH0', 'N', 'S'],
    when: [{ pattern: /\bentrance\s+(the)\b/i, phones: ['EH1', 'N', 'T', 'R', 'AH0', 'N', 'S'] }],
  },
  invalid: {
    phones: ['IH0', 'N', 'V', 'AE1', 'L', 'IH0', 'D'],
    when: [{ pattern: /\binvalid\s+(ticket)\b/i, phones: ['IH0', 'N', 'V', 'AE1', 'L', 'IH0', 'D'] }],
  },
  overlap: {
    phones: ['OW1', 'V', 'ER0', 'L', 'AE2', 'P'],
    when: [{ pattern: /\boverlap\s+(with)\b/i, phones: ['OW1', 'V', 'ER0', 'L', 'AE2', 'P'] }],
  },
  overflow: {
    phones: ['OW1', 'V', 'ER0', 'F', 'L', 'OW2'],
    when: [{ pattern: /\boverflow\s+(the)\b/i, phones: ['OW1', 'V', 'ER0', 'F', 'L', 'OW2'] }],
  },
  learned: {
    phones: ['L', 'ER1', 'N', 'D'],
    when: [{ pattern: /\blearned\s+(quickly|fast)\b/i, phones: ['L', 'ER1', 'N', 'IH0', 'D'] }],
  },
  blessed: {
    phones: ['B', 'L', 'EH1', 'S', 'IH0', 'D'],
    when: [{ pattern: /\bblessed\s+(be|event)\b/i, phones: ['B', 'L', 'EH1', 'S', 'T'] }],
  },
  upgrade: {
    phones: ['AH0', 'P', 'G', 'R', 'EY1', 'D'],
    when: [{ pattern: /\bupgrade\s+(the)\b/i, phones: ['AH0', 'P', 'G', 'R', 'EY1', 'D'] }],
  },
};

export function resolveHeteronymPhones(
  word: string,
  sentence: string,
  wordIndex: number,
): readonly string[] | undefined {
  const key = word.toLowerCase();
  const entry = HETERONYM_LEXICON[key];
  if (!entry) {
    return undefined;
  }
  const tokens = sentence.toLowerCase().match(/[a-z']+/g) ?? [];
  const window = tokens.slice(Math.max(0, wordIndex - 3), wordIndex + 4).join(' ');
  const context = `${sentence} ${window}`;
  if (entry.when) {
    for (const rule of entry.when) {
      if (rule.pattern.test(context)) {
        return rule.phones;
      }
    }
  }
  return entry.phones;
}
