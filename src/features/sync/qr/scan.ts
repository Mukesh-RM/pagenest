import jsQR from 'jsqr';

export function decodeQrFromImageData(data: ImageData): string | undefined {
  const result = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
  return result?.data;
}

/** Sample the center of a video frame for QR content. */
export function scanVideoFrame(video: HTMLVideoElement): string | undefined {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return undefined;
  const canvas = document.createElement('canvas');
  const size = Math.min(video.videoWidth, video.videoHeight, 640);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const sx = (video.videoWidth - size) / 2;
  const sy = (video.videoHeight - size) / 2;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
  const image = ctx.getImageData(0, 0, size, size);
  return decodeQrFromImageData(image);
}
