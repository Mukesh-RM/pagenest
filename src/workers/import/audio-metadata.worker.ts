import { serveRpc, type RpcPort } from '@/data/rpc';
import { parseAudio } from './parsers/audio';

/**
 * Reads audio tags with music-metadata. Kept in its own worker because the library is large:
 * it is only downloaded and started when someone imports an audio file. Started by `import.worker.ts`.
 */
serveRpc(self as unknown as RpcPort, { parseAudio });
