import { FRAME_LENGTH } from './constants'

export type GeneratorSource = 'sine' | 'triangle' | 'saw' | 'square'

export type GeneratorParamValues = {
  phase: number
  pulseWidth: number
  harmonicOrder: number
  harmonicAmount: number
  drive: number
}

export type GeneratorParamKey = keyof GeneratorParamValues

export type GeneratorFrameParams = {
  source: GeneratorSource
} & GeneratorParamValues

export const GENERATOR_SOURCE_ORDER: GeneratorSource[] = [
  'sine',
  'triangle',
  'saw',
  'square',
]

export const GENERATOR_SOURCE_DEFINITIONS: Record<
  GeneratorSource,
  {
    label: string
    params: GeneratorParamKey[]
  }
> = {
  sine: {
    label: 'Sine',
    params: [
      'phase',
      'pulseWidth',
      'harmonicOrder',
      'harmonicAmount',
      'drive',
    ],
  },
  triangle: {
    label: 'Triangle',
    params: [
      'phase',
      'pulseWidth',
      'harmonicOrder',
      'harmonicAmount',
      'drive',
    ],
  },
  saw: {
    label: 'Saw',
    params: [
      'phase',
      'pulseWidth',
      'harmonicOrder',
      'harmonicAmount',
      'drive',
    ],
  },
  square: {
    label: 'Square',
    params: ['phase', 'pulseWidth'],
  },
}

function wrapPhase(phase: number) {
  return ((phase % 1) + 1) % 1
}

function phaseAt(sampleIndex: number, phaseOffset: number) {
  return wrapPhase(sampleIndex / FRAME_LENGTH + phaseOffset)
}

function getPulseWidth(amount: number) {
  return 0.5 + amount * 0.49
}

function applyPulseWidth(phase: number, amount: number) {
  const pulseWidth = getPulseWidth(amount)

  if (phase < pulseWidth) {
    return (phase / pulseWidth) * 0.5
  }

  return 0.5 + ((phase - pulseWidth) / (1 - pulseWidth)) * 0.5
}

function renderSample(source: GeneratorSource, phase: number) {
  if (source === 'sine') {
    return Math.sin(Math.PI * 2 * phase)
  }

  if (source === 'triangle') {
    if (phase < 0.25) return phase * 4
    if (phase < 0.75) return 2 - phase * 4
    return phase * 4 - 4
  }

  if (source === 'saw') {
    return 1 - phase * 2
  }

  return phase < 0.5 ? 1 : -1
}

function normalize(samples: Float32Array) {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]))
  }

  if (peak === 0) return
  for (let i = 0; i < samples.length; i++) {
    samples[i] /= peak
  }
}

function saturateSample(sample: number, amount: number) {
  if (amount === 0) return sample

  const drive = 1 + amount * 24
  return Math.tanh(sample * drive) / Math.tanh(drive)
}

function chebyshev(order: number, sample: number) {
  if (order <= 1) return sample
  if (order === 2) return 2 * sample * sample - 1

  let previous = sample
  let current = 2 * sample * sample - 1

  for (let n = 3; n <= order; n++) {
    const next = 2 * sample * current - previous
    previous = current
    current = next
  }

  return current
}

function applyHarmonicDistortion(
  sample: number,
  amount: number,
  order: number,
) {
  if (amount === 0) return sample

  const harmonicOrder = Math.max(2, Math.round(order))
  return sample + amount * chebyshev(harmonicOrder, sample)
}

export function renderGeneratorFrame({
  source,
  phase,
  pulseWidth,
  harmonicOrder,
  harmonicAmount,
  drive,
}: GeneratorFrameParams) {
  const samples = new Float32Array(FRAME_LENGTH)

  for (let i = 0; i < FRAME_LENGTH; i++) {
    const shapedPhase = applyPulseWidth(phaseAt(i, phase), pulseWidth)
    const baseSample = renderSample(source, shapedPhase)
    const harmonicSample = applyHarmonicDistortion(
      baseSample,
      harmonicAmount,
      harmonicOrder,
    )
    samples[i] = saturateSample(harmonicSample, drive)
  }

  normalize(samples)
  return samples
}
