import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/ui';
import { normalizePairingCode } from '@/features/sync/pairing-code';
import type { SyncImportResult } from '@/workers/sync/protocol';
import { getSyncClient } from '../registry';
import { QrReassembler, SignalReassembler, chunkEncryptedForQr, chunkSignalForQr } from '../qr/frames';
import type { EncryptedSyncBlob } from '@/workers/sync/crypto';
import type { SyncMergeSummary } from '@/workers/sync/merge';

type Status = { kind: 'idle' } | { kind: 'busy'; label: string; value: number } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

export interface SyncQrProps {
  mode: 'qr-send' | 'qr-receive' | 'webrtc-send' | 'webrtc-receive';
  pairingCode: string;
  enteredCode: string;
  busy: boolean;
  onStatus: (status: Status) => void;
}

/** QR animation, camera scan and optional WebRTC (loaded only when a wireless mode is chosen). */
export function SyncWirelessPanel({ mode, pairingCode, enteredCode, busy, onStatus }: SyncQrProps) {
  const [qrUrl, setQrUrl] = useState<string | undefined>();
  const [qrFrame, setQrFrame] = useState({ index: 0, total: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (mode !== 'qr-send' && mode !== 'webrtc-send') return undefined;
    let frames: string[] = [];
    let frameIndex = 0;
    let cancelled = false;
    const client = getSyncClient();

    const load = async (): Promise<void> => {
      onStatus({ kind: 'busy', label: 'Preparing QR', value: 0 });
      try {
        if (mode === 'qr-send') {
          const encrypted = await client.run<EncryptedSyncBlob>({ type: 'sync-export-encrypted', code: pairingCode }).done;
          frames = chunkEncryptedForQr(encrypted).frames;
        } else {
          const { createOfferSide } = await import('../webrtc/peer');
          const { offer } = await createOfferSide();
          frames = chunkSignalForQr('offer', JSON.stringify(offer)).frames;
        }
        if (cancelled) return;
        setQrFrame({ index: 0, total: frames.length });
        onStatus({ kind: 'idle' });
      } catch (error) {
        if (!cancelled) {
          onStatus({
            kind: 'error',
            message: error instanceof Error && error.message ? error.message : 'Could not build QR codes. Try again.',
          });
        }
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (frames.length === 0) return;
      frameIndex = (frameIndex + 1) % frames.length;
      setQrFrame({ index: frameIndex, total: frames.length });
      void import('../qr/render').then(({ renderQrDataUrl }) =>
        renderQrDataUrl(frames[frameIndex] as string).then((url) => {
          if (!cancelled) setQrUrl(url);
        }),
      );
    }, 600);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mode, pairingCode, onStatus]);

  const startCamera = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    await video.play();
  }, []);

  useEffect(() => {
    if (mode !== 'qr-receive' && mode !== 'webrtc-receive') return undefined;
    const reasm: QrReassembler | SignalReassembler = mode === 'qr-receive' ? new QrReassembler() : new SignalReassembler();
    let raf = 0;
    const tick = (): void => {
      const video = videoRef.current;
      if (video) {
        void import('../qr/scan').then(({ scanVideoFrame }) => {
          const text = scanVideoFrame(video);
          if (!text) return;
          if (mode === 'qr-receive') {
            const encrypted = (reasm as QrReassembler).push(text);
            if (encrypted && normalizePairingCode(enteredCode).length >= 4) {
              void (async () => {
                onStatus({ kind: 'busy', label: 'Merging', value: 0.4 });
                try {
                  const merge = await getSyncClient().run<SyncMergeSummary>({ type: 'sync-import-encrypted', encrypted, code: enteredCode }).done;
                  onStatus({ kind: 'done', message: `Merged ${merge.highlightsMerged} highlights and ${merge.progressMerged} progress rows.` });
                } catch (error) {
                  onStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Sync failed.' });
                }
              })();
              (reasm as QrReassembler).reset();
            }
          } else {
            const signal = (reasm as SignalReassembler).push(text);
            if (signal?.kind === 'offer') {
              void (async () => {
                const { acceptOfferSide } = await import('../webrtc/peer');
                const { pc, answer, channel } = await acceptOfferSide(JSON.parse(signal.sdp) as RTCSessionDescriptionInit);
                (window as unknown as { __pnSyncPc?: RTCPeerConnection }).__pnSyncPc = pc;
                const { renderQrDataUrl } = await import('../qr/render');
                const ansFrames = chunkSignalForQr('answer', JSON.stringify(answer));
                setQrFrame({ index: 0, total: ansFrames.total });
                setQrUrl(await renderQrDataUrl(ansFrames.frames[0] as string));
                const ch = await channel;
                ch.onmessage = async (ev) => {
                  if (!(ev.data instanceof ArrayBuffer) && !(ev.data instanceof Blob)) return;
                  const buf = ev.data instanceof Blob ? await ev.data.arrayBuffer() : ev.data;
                  onStatus({ kind: 'busy', label: 'Merging', value: 0.5 });
                  try {
                    const file = new Blob([buf]);
                    await getSyncClient().run<SyncImportResult>({ type: 'sync-import-file', file, code: enteredCode }).done;
                    onStatus({ kind: 'done', message: 'Sync merged onto this device.' });
                  } catch (error) {
                    onStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Sync failed.' });
                  }
                };
              })();
            }
          }
        });
      }
      raf = requestAnimationFrame(tick);
    };
    void startCamera().catch(() => onStatus({ kind: 'error', message: 'Camera access is needed to scan QR codes.' }));
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, enteredCode, onStatus, startCamera]);

  async function webrtcSend(): Promise<void> {
    onStatus({ kind: 'busy', label: 'Preparing direct transfer', value: 0.2 });
    try {
      const { blob } = await getSyncClient().run<{ blob: Blob; fileName: string; pairingCode: string }>({
        type: 'sync-export-file',
        code: pairingCode,
        includeFiles: false,
      }).done;
      const { createOfferSide, sendBytes } = await import('../webrtc/peer');
      const { renderQrDataUrl } = await import('../qr/render');
      const { pc, channel, offer } = await createOfferSide();
      (window as unknown as { __pnSyncPc?: RTCPeerConnection }).__pnSyncPc = pc;
      const offerFrames = chunkSignalForQr('offer', JSON.stringify(offer));
      setQrUrl(await renderQrDataUrl(offerFrames.frames[0] as string));
      setQrFrame({ index: 0, total: offerFrames.total });
      channel.onopen = () => {
        void blob.arrayBuffer().then((buf) => sendBytes(channel, new Uint8Array(buf)));
      };
      onStatus({ kind: 'done', message: 'Show this QR on your other device, then scan its answer QR here.' });
    } catch (error) {
      onStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Direct transfer failed.' });
    }
  }

  if (mode === 'qr-send' || mode === 'webrtc-send') {
    return (
      <div className="pn-sync-qr">
        {qrUrl ? <img src={qrUrl} alt="Animated QR code for device sync" data-testid="sync-qr-image" /> : null}
        {qrFrame.total > 1 ? (
          <p>
            Frame {qrFrame.index + 1} of {qrFrame.total} — hold steady until it cycles.
          </p>
        ) : null}
        {mode === 'webrtc-send' ? (
          <Button block disabled={busy} onClick={() => void webrtcSend()}>
            Start direct transfer
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pn-sync-scan">
      <video ref={videoRef} playsInline muted aria-label="Camera preview for QR scanning" />
      <p>Point at the other screen. Enter its pairing code first.</p>
    </div>
  );
}
