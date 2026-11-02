import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface NarrationReaderBridge {
  /** Read the given snippet aloud (selection or similar). */
  speakSelection(text: string): Promise<void>;
  /** Expand read-aloud controls in the footer dock. */
  openDock(): void;
}

type Register = (bridge: NarrationReaderBridge | undefined) => void;

const BridgeCtx = createContext<NarrationReaderBridge | undefined>(undefined);
const RegisterCtx = createContext<Register>(() => undefined);

export function NarrationReaderBridgeProvider({ children }: { readonly children: ReactNode }) {
  const [bridge, setBridge] = useState<NarrationReaderBridge | undefined>();
  const register = useMemo<Register>(() => (next) => setBridge(next), []);
  return (
    <RegisterCtx.Provider value={register}>
      <BridgeCtx.Provider value={bridge}>{children}</BridgeCtx.Provider>
    </RegisterCtx.Provider>
  );
}

export function useNarrationReaderBridge(): NarrationReaderBridge | undefined {
  return useContext(BridgeCtx);
}

export function useRegisterNarrationReaderBridge(): Register {
  return useContext(RegisterCtx);
}
