import QRCode from "qrcode";

export async function generateQrMarkdown(url: string): Promise<string> {
  const dataUri = await QRCode.toDataURL(url, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  return `![AFK Mode QR Code](${dataUri})`;
}
