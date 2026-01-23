import type { PeaksCache, PeaksCacheLevel, VisiblePeaks } from '../types'

export function buildPeaksCache(
  audioBuffer: AudioBuffer,
  maxCacheWidth: number,
): PeaksCache {
  const nChannels = audioBuffer.numberOfChannels
  const built: PeaksCache = []

  for (let ch = 0; ch < nChannels; ch++) {
    const floatArray = audioBuffer.getChannelData(ch)
    const totalSamples = floatArray.length
    const cacheLevels: Array<PeaksCacheLevel> = []

    let blockSize = 1
    while (true) {
      const nBlocks = Math.ceil(totalSamples / blockSize)
      if (nBlocks < 4) break

      const mins = new Float32Array(nBlocks)
      const maxs = new Float32Array(nBlocks)
      for (let i = 0; i < nBlocks; i++) {
        const start = i * blockSize
        const end = Math.min(start + blockSize, totalSamples)
        let min = 1.0
        let max = -1.0
        for (let j = start; j < end; j++) {
          const s = floatArray[j]
          if (s < min) min = s
          if (s > max) max = s
        }
        mins[i] = min
        maxs[i] = max
      }
      cacheLevels.push({
        blockSize,
        mins,
        maxs,
      })

      if (nBlocks <= maxCacheWidth) break
      blockSize *= 2
    }

    built.push(cacheLevels)
  }

  return built
}

export function getVisiblePeaksFromCache({
  peakCachePerChannel: peaksCache,
  nChannels,
  viewStartSample,
  viewEndSample,
  samplesPerPixel,
  canvasWidth,
}: {
  peakCachePerChannel: PeaksCache
  nChannels: number
  viewStartSample: number
  viewEndSample: number
  samplesPerPixel: number
  canvasWidth: number
}): VisiblePeaks {
  const visibleMinPerChannel: Array<Float32Array> = []
  const visibleMaxPerChannel: Array<Float32Array> = []

  for (let ch = 0; ch < nChannels; ch++) {
    const peakCacheLevels = peaksCache[ch]
    let bestLevel = peakCacheLevels[peakCacheLevels.length - 1]
    for (let i = peakCacheLevels.length - 1; i >= 0; i--) {
      if (peakCacheLevels[i].blockSize <= samplesPerPixel) {
        bestLevel = peakCacheLevels[i]
        break
      }
    }

    const { blockSize, mins: cachedMin, maxs: cachedMax } = bestLevel

    const blockStartIdx = Math.floor(viewStartSample / blockSize)
    const blockEndIdx = Math.ceil(viewEndSample / blockSize)
    const visibleBlocks = blockEndIdx - blockStartIdx
    let blocksPerPixel = visibleBlocks / canvasWidth
    if (blocksPerPixel < 1) blocksPerPixel = 1

    const visibleMin = new Float32Array(canvasWidth)
    const visibleMax = new Float32Array(canvasWidth)

    for (let i = 0; i < canvasWidth; i++) {
      const blockStart = Math.floor(blockStartIdx + i * blocksPerPixel)
      const blockEnd = Math.floor(blockStartIdx + (i + 1) * blocksPerPixel)

      let min = 1.0
      let max = -1.0

      for (let j = blockStart; j < blockEnd && j < cachedMin.length; j++) {
        if (cachedMin[j] < min) min = cachedMin[j]
        if (cachedMax[j] > max) max = cachedMax[j]
      }

      visibleMin[i] = min
      visibleMax[i] = max
    }

    visibleMinPerChannel.push(visibleMin)
    visibleMaxPerChannel.push(visibleMax)
  }

  return {
    visibleMinPerChannel,
    visibleMaxPerChannel,
  }
}
