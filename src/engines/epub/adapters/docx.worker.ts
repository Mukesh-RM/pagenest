/// <reference lib="webworker" />
import { convertDocxInline } from './docx-core';

/** Worker side of DOCX conversion: receives the file bytes, answers with HTML (images inline as data URIs). */
self.onmessage = (event: MessageEvent<ArrayBuffer>): void => {
  convertDocxInline(event.data)
    .then((result) => self.postMessage({ ok: true, result }))
    .catch(() => self.postMessage({ ok: false }));
};
