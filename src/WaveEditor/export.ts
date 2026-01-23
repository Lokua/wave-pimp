import encodeWav from '../encodeWav'
import type { Settings } from '../types'

async function resampleBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate: number,
): Promise<AudioBuffer> {
  const targetLength = Math.ceil(audioBuffer.duration * targetSampleRate)
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    targetLength,
    targetSampleRate,
  )
  const source = offlineContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineContext.destination)
  source.start(0)
  return await offlineContext.startRendering()
}

export async function encodeWavForSettings(
  audioBuffer: AudioBuffer,
  settings: Settings,
): Promise<Uint8Array> {
  const buffer =
    audioBuffer.sampleRate === settings.sampleRate
      ? audioBuffer
      : await resampleBuffer(audioBuffer, settings.sampleRate)
  return encodeWav(buffer, settings.bitDepth)
}
