/**
 * Encodes an AudioBuffer to WAV format
 * @param audioBuffer - Web Audio AudioBuffer
 * @param bitDepth - 8, 16, 24, or 32
 * @param float - If true and bitDepth is 32, encode as IEEE float
 * @returns WAV file bytes
 */
export default function encodeWav(
  audioBuffer: AudioBuffer,
  bitDepth: 8 | 16 | 24 | 32 = 24,
  float: boolean = false,
): Uint8Array {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const numSamples = audioBuffer.length
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = numSamples * blockAlign
  const audioFormat = float && bitDepth === 32 ? 3 : 1

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, audioFormat, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Get all channels upfront
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch))
  }

  // Interleave and write samples
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      writeSample(view, offset, channels[ch][i], bitDepth, float)
      offset += bytesPerSample
    }
  }

  return new Uint8Array(buffer)
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

function writeSample(
  view: DataView,
  offset: number,
  sample: number,
  bitDepth: 8 | 16 | 24 | 32,
  float: boolean,
): void {
  const s = Math.max(-1, Math.min(1, sample))

  switch (bitDepth) {
    case 8:
      view.setUint8(offset, ((s + 1) * 127.5) | 0)
      break
    case 16:
      view.setInt16(offset, (s * 0x7fff) | 0, true)
      break
    case 24: {
      const value = (s * 0x7fffff) | 0
      view.setUint8(offset, value & 0xff)
      view.setUint8(offset + 1, (value >> 8) & 0xff)
      view.setUint8(offset + 2, (value >> 16) & 0xff)
      break
    }
    case 32:
      if (float) {
        view.setFloat32(offset, s, true)
      } else {
        view.setInt32(offset, (s * 0x7fffffff) | 0, true)
      }
      break
  }
}
