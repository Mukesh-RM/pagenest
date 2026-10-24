// @vitest-environment node
import { it } from 'vitest';
import { makePdf } from '../src/workers/import/testing/fixtures';
import { parsePdf } from '../src/workers/import/parsers/pdf';
it('x', async () => {
  const b = makePdf({ title: 'A', author: 'Pat', pages: 7 });
  console.log(new TextDecoder('latin1').decode(b).slice(-400));
  console.log(await parsePdf(new Blob([b as BlobPart])));
});
