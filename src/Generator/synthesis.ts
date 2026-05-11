import { FRAME_LENGTH } from './constants'

export type GeneratorSource = 'sine' | 'triangle' | 'saw' | 'square'

export type GeneratorParamValues = {
  phase: number
  pulseWidth: number
  fmRatio: number
  fmAmount: number
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
      'fmRatio',
      'fmAmount',
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
      'fmRatio',
      'fmAmount',
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
      'fmRatio',
      'fmAmount',
      'harmonicOrder',
      'harmonicAmount',
      'drive',
    ],
  },
  square: {
    label: 'Square',
    params: ['phase', 'pulseWidth', 'fmRatio', 'fmAmount'],
  },
}

function wrapPhase(phase: number) {
  return ((phase % 1) + 1) % 1
}

function phaseAt(sampleIndex: number, phaseOffset: number) {
  return wrapPhase(sampleIndex / (FRAME_LENGTH - 1) + phaseOffset)
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

function snapFmRatio(ratio: number) {
  return Math.max(1, Math.min(12, Math.round(ratio)))
}

function applyFrequencyModulation(
  phase: number,
  ratio: number,
  amount: number,
) {
  if (amount === 0) return phase

  const modulator = Math.sin(Math.PI * 2 * snapFmRatio(ratio) * phase)
  return wrapPhase(phase + amount * 0.5 * modulator)
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

function sourceUsesParam(
  source: GeneratorSource,
  param: GeneratorParamKey,
) {
  return GENERATOR_SOURCE_DEFINITIONS[source].params.includes(param)
}

function applyHarmonicDistortion(
  source: GeneratorSource,
  sample: number,
  phase: number,
  amount: number,
  order: number,
) {
  if (amount === 0) return sample

  const harmonicOrder = Math.max(2, Math.round(order))
  const harmonicPhase = wrapPhase(phase * harmonicOrder)
  const harmonic = renderSample(source, harmonicPhase)
  return sample + amount * harmonic
}

export function renderGeneratorFrame({
  source,
  phase,
  pulseWidth,
  fmRatio,
  fmAmount,
  harmonicOrder,
  harmonicAmount,
  drive,
}: GeneratorFrameParams) {
  const samples = new Float32Array(FRAME_LENGTH)
  const effectiveFmAmount = sourceUsesParam(source, 'fmAmount')
    ? fmAmount
    : 0
  const effectiveHarmonicAmount = sourceUsesParam(
    source,
    'harmonicAmount',
  )
    ? harmonicAmount
    : 0
  const effectiveDrive = sourceUsesParam(source, 'drive') ? drive : 0

  for (let i = 0; i < FRAME_LENGTH; i++) {
    const modulatedPhase = applyFrequencyModulation(
      phaseAt(i, phase),
      fmRatio,
      effectiveFmAmount,
    )
    const shapedPhase = applyPulseWidth(modulatedPhase, pulseWidth)
    const baseSample = renderSample(source, shapedPhase)
    const harmonicSample = applyHarmonicDistortion(
      source,
      baseSample,
      shapedPhase,
      effectiveHarmonicAmount,
      harmonicOrder,
    )
    samples[i] = saturateSample(harmonicSample, effectiveDrive)
  }

  normalize(samples)
  return samples
}
