import type { PeaksCache, VisiblePeaks } from '../types'

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
    if (samplesPerPixel < 1) {
      bestLevel = peakCacheLevels[0]
    } else {
      for (let i = peakCacheLevels.length - 1; i >= 0; i--) {
        if (peakCacheLevels[i].blockSize <= samplesPerPixel) {
          bestLevel = peakCacheLevels[i]
          break
        }
      }
    }

    const { blockSize, mins: cachedMin, maxs: cachedMax } = bestLevel

    const blockStartIdx = Math.floor(viewStartSample / blockSize)
    const blockEndIdx = Math.ceil(viewEndSample / blockSize)
    const visibleBlocks = blockEndIdx - blockStartIdx
    const blocksPerPixel = visibleBlocks / canvasWidth

    const visibleMin = new Float32Array(canvasWidth)
    const visibleMax = new Float32Array(canvasWidth)

    for (let i = 0; i < canvasWidth; i++) {
      const blockStart = Math.floor(blockStartIdx + i * blocksPerPixel)
      const blockEnd = Math.max(
        blockStart + 1,
        Math.floor(blockStartIdx + (i + 1) * blocksPerPixel),
      )

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
