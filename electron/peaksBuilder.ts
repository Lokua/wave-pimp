type PeaksCacheLevel = {
  blockSize: number
  mins: Float32Array
  maxs: Float32Array
}

type PeaksCacheChannel = Array<PeaksCacheLevel>
type PeaksCache = Array<PeaksCacheChannel>

export type BuildPeaksCacheInput = {
  channelData: Float32Array[]
  maxCacheWidth: number
}

export type BuildPeaksCacheOutput = {
  peaksCache: PeaksCache
}

export function buildPeaksCache(
  channelData: Float32Array[],
  maxCacheWidth: number,
): PeaksCache {
  const nChannels = channelData.length
  const built: PeaksCache = []

  for (let ch = 0; ch < nChannels; ch++) {
    const floatArray = channelData[ch]
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
