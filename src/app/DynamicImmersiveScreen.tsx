import { useEffect, useState, type ComponentType } from 'react';
import { ImmersiveFallback } from './ScreenFallback';

type ImmersiveKind = 'read' | 'listen';

/**
 * Loads read/listen screen components on demand so their dependency graphs (reader, player) never
 * join the entry chunk's modulepreload list.
 */
export function DynamicImmersiveScreen({ kind }: { kind: ImmersiveKind }) {
  const [Screen, setScreen] = useState<ComponentType | null>(null);

  useEffect(() => {
    void import('./immersive-route-screens').then((m) => {
      setScreen(() => (kind === 'read' ? m.ReadScreen : m.ListenScreen));
    });
  }, [kind]);

  if (!Screen) return <ImmersiveFallback />;
  return <Screen />;
}
