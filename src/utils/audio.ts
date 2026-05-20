/**
 * Converts a base64 encoded raw 16-bit PCM audio stream (returned by Gemini TTS)
 * into a fully formed, playable and downloadable standard RIFF/WAVE Blob.
 * 
 * @param pcmBase64 Base64 string of raw 16-bit PCM samples
 * @param sampleRate Hertz (sample rate), default 24000 Hz for Gemini TTS
 * @returns Blob of 'audio/wav'
 */
export function pcmToWavBlob(pcmBase64: string, sampleRate: number = 24000): Blob {
  const binaryString = atob(pcmBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const buffer = new ArrayBuffer(44 + bytes.length);
  const view = new DataView(buffer);

  // Helper inside to write ASCII chunks
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // 1. "RIFF" chunk descriptor
  writeString(0, 'RIFF');
  // File size - chunk size (36 + data size)
  view.setUint32(4, 36 + bytes.length, true);
  // Format
  writeString(8, 'WAVE');

  // 2. "fmt " sub-chunk
  writeString(12, 'fmt ');
  // Sub-chunk size (16 for PCM)
  view.setUint32(16, 16, true);
  // Audio format (1 for uncompressed PCM)
  view.setUint16(20, 1, true);
  // Number of channels (1 = Mono)
  view.setUint16(22, 1, true);
  // Sample rate (24000 Hz)
  view.setUint32(24, sampleRate, true);
  // Byte rate = (sampleRate * numChannels * bitsPerSample / 8) -> 24000 * 1 * 2 = 48000
  view.setUint32(28, sampleRate * 2, true);
  // Block align = (numChannels * bitsPerSample / 8) -> 1 * 2 = 2
  view.setUint16(32, 2, true);
  // Bits per sample (16-bit)
  view.setUint16(34, 16, true);

  // 3. "data" sub-chunk
  writeString(36, 'data');
  // Sub-chunk size (audio length)
  view.setUint32(40, bytes.length, true);

  // Copy raw samples after the 44-byte header
  const pcmBuffer = new Uint8Array(buffer, 44);
  pcmBuffer.set(bytes);

  return new Blob([buffer], { type: "audio/wav" });
}
