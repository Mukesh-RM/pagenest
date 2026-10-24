/**
 * Android Web Share Target (blueprint 6 and 15). The service worker receives the POST from the share sheet,
 * parks the files in the Cache API and redirects into the app. The Library feature then calls
 * `takeSharedFiles()` to import them (into OPFS) and the inbox is emptied. No network is involved.
 */
export const SHARE_PATH = '/share-target';
export const SHARE_INBOX_CACHE = 'pagenest-share-inbox-v1';
const INBOX_PREFIX = '/share-inbox/';
const NAME_HEADER = 'X-File-Name';

/** Service worker side: store every shared file and answer with a redirect to the app. */
export async function handleShareRequest(
  request: Request,
  cacheStorage: CacheStorage,
  now: () => number = Date.now,
): Promise<Response> {
  let files: File[] = [];
  try {
    const form = await request.formData();
    files = form.getAll('files').filter((v): v is File => typeof v !== 'string');
  } catch {
    files = [];
  }
  const cache = await cacheStorage.open(SHARE_INBOX_CACHE);
  const stamp = now();
  await Promise.all(
    files.map((file, index) =>
      cache.put(
        new Request(new URL(`${INBOX_PREFIX}${stamp}-${index}`, request.url)),
        new Response(file, {
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'Content-Length': String(file.size),
            [NAME_HEADER]: encodeURIComponent(file.name),
          },
        }),
      ),
    ),
  );
  return Response.redirect(new URL(`/?share=${files.length}`, request.url).toString(), 303);
}

/** App side: read every shared file (oldest first) and empty the inbox. Returns [] when nothing was shared. */
export async function takeSharedFiles(cacheStorage: CacheStorage | undefined = globalThis.caches): Promise<File[]> {
  if (!cacheStorage || !(await cacheStorage.has(SHARE_INBOX_CACHE))) return [];
  const cache = await cacheStorage.open(SHARE_INBOX_CACHE);
  const requests = [...(await cache.keys())].sort((a, b) => a.url.localeCompare(b.url, undefined, { numeric: true }));
  const files: File[] = [];
  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;
    const name = decodeURIComponent(response.headers.get(NAME_HEADER) ?? 'shared-file');
    const type = response.headers.get('Content-Type') ?? '';
    files.push(new File([await response.blob()], name, { type }));
  }
  await cacheStorage.delete(SHARE_INBOX_CACHE);
  return files;
}
