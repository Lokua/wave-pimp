import { PeaksCache, PeaksCacheLevel } from '../src/types'

/**
 * Builds a multi-resolution waveform peaks cache.
 *
 * The cache consists of multiple levels at increasing block sizes
 * (1, 2, 4, 8, ...). Each level stores one min/max pair per block.
 *
 * For a given blockSize:
 *   nBlocks = ceil(totalSamples / blockSize)
 *
 * `maxWidth` is used only as a stopping condition for cache generation.
 * The function continues generating finer-to-coarser levels until it
 * reaches the first level where `nBlocks <= maxWidth`, then stops.
 *
 * As a result:
 * - Levels with `nBlocks > maxWidth` are normally generated and stored.
 * - Exactly one level with `nBlocks <= maxWidth` is guaranteed to exist.
 * - No levels coarser than that are generated.
 *
 * When `onlyLowestLevel` is true, all earlier levels are skipped and only
 * the first level where `nBlocks <= maxWidth` is built.
 *
 * This guarantees that the cache always contains at least one level that
 * can be drawn on a canvas up to `maxWidth` pixels wide, while optionally
 * preserving higher-resolution levels for zoomed-in rendering.
 *
 * The return shape is:
 * PeaksCache = Array<PeaksCacheChannel>
 * PeaksCacheChannel = Array<PeaksCacheLevel>
 * PeaksCacheLevel = { blockSize, mins: Float32Array, maxs: Float32Array }
 *
 * Example with 2 channels and 2 levels per channel:
 * ```ts
 * const cache = buildPeaksCache(channelData, 1024)
 * // cache: [
 * //   [ // channel 0
 * //     { blockSize: 1, mins: Float32Array([..]), maxs: Float32Array([..]) },
 * //     { blockSize: 2, mins: Float32Array([..]), maxs: Float32Array([..]) },
 * //     // ... all the way up to blockSize that fits within maxWidth
 * //   ],
 * //   [ // channel 1
 * //     { blockSize: 1, mins: Float32Array([..]), maxs: Float32Array([..]) },
 * //     { blockSize: 2, mins: Float32Array([..]), maxs: Float32Array([..]) },
 * //   ],
 * // ]
 * ```
 */
export function buildPeaksCache(
  channelData: Float32Array[],
  maxWidth: number,
  options: { onlyLowestLevel?: boolean } = {},
): PeaksCache {
  const nChannels = channelData.length
  const built: PeaksCache = []
  const onlyLowestLevel = options.onlyLowestLevel ?? false

  for (let ch = 0; ch < nChannels; ch++) {
    const floatArray = channelData[ch]
    const totalSamples = floatArray.length
    const cacheLevels: Array<PeaksCacheLevel> = []

    let blockSize = 1
    while (true) {
      const nBlocks = Math.ceil(totalSamples / blockSize)
      if (nBlocks < 4) break
      if (onlyLowestLevel && nBlocks > maxWidth) {
        blockSize *= 2
        continue
      }

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

      if (nBlocks <= maxWidth) break
      blockSize *= 2
    }

    built.push(cacheLevels)
  }

  return built
}
