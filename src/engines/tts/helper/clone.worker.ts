import { serveRpc, type RpcPort } from '@/data/rpc';
import { createCloneRuntime } from './clone-runtime';

export type { CloneTier, CloneWorkerApi } from './clone-runtime';

serveRpc(self as unknown as RpcPort, createCloneRuntime());
