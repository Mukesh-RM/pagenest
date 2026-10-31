import QRCode from 'qrcode';

export async function renderQrDataUrl(text: string, size = 280): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: size,
    color: { dark: '#1C1B19', light: '#FAFAF7' },
  });
}
