export const viridisColorMap: number[][] = Array.from(
  { length: 256 },
  (_, i) => {
    const t = i / 255
    const r = Math.max(
      0,
      Math.min(
        1,
        -0.06 + 2.95 * t - 5.5 * t ** 2 + 4.27 * t ** 3 - 2.4 * t ** 4,
      ),
    )
    const g = Math.max(
      0,
      Math.min(1, 0.32 + 2.15 * t - 4.85 * t ** 2 + 3.38 * t ** 3),
    )
    const b = Math.max(0, Math.min(1, 0.49 + 1.44 * t - 1.63 * t ** 2))
    return [r, g, b, 1.0]
  },
)

export const grayscaleColorMap: number[][] = Array.from(
  { length: 256 },
  (_, i) => {
    const val = i / 255
    return [val, val, val, 1.0]
  },
)
