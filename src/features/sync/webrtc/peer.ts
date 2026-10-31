/** Free public STUN only — no TURN, no backend (blueprint: no paid services). */
export const PUBLIC_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: PUBLIC_STUN_SERVERS });
}

export interface PeerChannel {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
}

/** Caller creates offer and a data channel named `sync`. */
export async function createOfferSide(): Promise<{ pc: RTCPeerConnection; offer: RTCSessionDescriptionInit; channel: RTCDataChannel }> {
  const pc = createPeerConnection();
  const channel = pc.createDataChannel('sync', { ordered: true });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIceGathering(pc);
  return { pc, channel, offer: pc.localDescription ?? offer };
}

/** Answerer accepts offer; creates answer after remote description is set. */
export async function acceptOfferSide(offer: RTCSessionDescriptionInit): Promise<{ pc: RTCPeerConnection; answer: RTCSessionDescriptionInit; channel: Promise<RTCDataChannel> }> {
  const pc = createPeerConnection();
  const channel = new Promise<RTCDataChannel>((resolve, reject) => {
    pc.ondatachannel = (ev) => resolve(ev.channel);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') reject(new Error('Direct transfer could not connect. Try QR sync or a sync file instead.'));
    };
  });
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitIceGathering(pc);
  return { pc, answer: pc.localDescription ?? answer, channel };
}

export async function finishAnswerSide(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit): Promise<void> {
  await pc.setRemoteDescription(answer);
}

function waitIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', done);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', done);
    setTimeout(resolve, 4000);
  });
}

export function sendBytes(channel: RTCDataChannel, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.onopen = () => {
      try {
        channel.send(new Blob([bytes as unknown as BlobPart]));
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    if (channel.readyState === 'open') {
      try {
        channel.send(new Blob([bytes as unknown as BlobPart]));
        resolve();
      } catch (error) {
        reject(error);
      }
    }
  });
}

export function receiveBytes(channel: RTCDataChannel): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    channel.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) chunks.push(new Uint8Array(ev.data));
      else if (ev.data instanceof Uint8Array) chunks.push(ev.data);
      else if (typeof ev.data === 'string') chunks.push(new TextEncoder().encode(ev.data));
    };
    channel.onclose = () => {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      resolve(out);
    };
    channel.onerror = () => reject(new Error('Direct transfer failed.'));
  });
}
