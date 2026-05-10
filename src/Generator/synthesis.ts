import { FRAME_LENGTH } from './constants'

export type GeneratorSource = 'additive' | 'saw' | 'square' | 'triangle'

export type GeneratorParamValues = {
  partialCount: number
  rolloff: number
  oddEvenBalance: number
  phaseDistortion: number
  fmAmount: number
  fmRatio: number
  drive: number
  fold: number
}

export type GeneratorParamKey = keyof GeneratorParamValues

export type GeneratorFrameParams = {
  source: GeneratorSource
} & GeneratorParamValues

export const GENERATOR_SOURCE_ORDER: GeneratorSource[] = [
  'additive',
  'saw',
  'square',
  'triangle',
]

export const GENERATOR_SOURCE_DEFINITIONS: Record<
  GeneratorSource,
  {
    label: string
    params: GeneratorParamKey[]
  }
> = {
  additive: {
    label: 'Additive',
    params: [
      'partialCount',
      'rolloff',
      'oddEvenBalance',
      'phaseDistortion',
      'fmAmount',
      'fmRatio',
      'drive',
      'fold',
    ],
  },
  saw: {
    label: 'Saw',
    params: [
      'partialCount',
      'phaseDistortion',
      'fmAmount',
      'fmRatio',
      'drive',
      'fold',
    ],
  },
  square: {
    label: 'Square',
    params: [
      'partialCount',
      'phaseDistortion',
      'fmAmount',
      'fmRatio',
      'drive',
      'fold',
    ],
  },
  triangle: {
    label: 'Triangle',
    params: [
      'partialCount',
      'phaseDistortion',
      'fmAmount',
      'fmRatio',
      'drive',
      'fold',
    ],
  },
}

function removeDcAndNormalize(samples: Float32Array) {
  let mean = 0
  for (const sample of samples) {
    mean += sample
  }
  mean /= samples.length

  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    samples[i] -= mean
    peak = Math.max(peak, Math.abs(samples[i]))
  }

  if (peak === 0) return
  for (let i = 0; i < samples.length; i++) {
    samples[i] /= peak
  }
}

function getOddEvenGain(harmonic: number, balance: number) {
  const isOdd = harmonic % 2 === 1
  if (isOdd) return balance > 0 ? 1 - balance : 1
  return balance < 0 ? 1 + balance : 1
}

function distortPhase(phase: number, amount: number) {
  if (amount === 0) return phase

  if (amount > 0) {
    return phase ** (1 + amount * 4)
  }

  return 1 - (1 - phase) ** (1 + -amount * 4)
}

function modulatePhase(phase: number, amount: number, ratio: number) {
  if (amount === 0) return phase

  return phase + amount * 0.25 * Math.sin(Math.PI * 2 * phase * ratio)
}

function foldSample(sample: number, amount: number) {
  if (amount === 0) return sample

  const drive = 1 + amount * 8
  let folded = sample * drive

  while (folded > 1 || folded < -1) {
    if (folded > 1) {
      folded = 2 - folded
    } else if (folded < -1) {
      folded = -2 - folded
    }
  }

  return folded
}

function saturateSample(sample: number, amount: number) {
  if (amount === 0) return sample

  const drive = 1 + amount * 24
  return Math.tanh(sample * drive) / Math.tanh(drive)
}

function getRenderedPartialCount(partialCount: number) {
  return Math.min(partialCount, FRAME_LENGTH / 2 - 1)
}

function applyOutputModifiers(
  samples: Float32Array,
  { drive, fold }: Pick<GeneratorParamValues, 'drive' | 'fold'>,
) {
  removeDcAndNormalize(samples)
  if (drive > 0) {
    for (let i = 0; i < samples.length; i++) {
      samples[i] = saturateSample(samples[i], drive)
    }
    removeDcAndNormalize(samples)
  }

  if (fold > 0) {
    for (let i = 0; i < samples.length; i++) {
      samples[i] = foldSample(samples[i], fold)
    }
    removeDcAndNormalize(samples)
  }
}

function getModulatedPhase(
  sampleIndex: number,
  {
    phaseDistortion,
    fmAmount,
    fmRatio,
  }: Pick<
    GeneratorParamValues,
    'phaseDistortion' | 'fmAmount' | 'fmRatio'
  >,
) {
  return modulatePhase(
    distortPhase(sampleIndex / FRAME_LENGTH, phaseDistortion),
    fmAmount,
    fmRatio,
  )
}

function renderAdditiveSource({
  partialCount,
  rolloff,
  oddEvenBalance,
  phaseDistortion,
  fmAmount,
  fmRatio,
}: GeneratorParamValues) {
  const samples = new Float32Array(FRAME_LENGTH)
  const renderedPartialCount = getRenderedPartialCount(partialCount)

  for (let i = 0; i < FRAME_LENGTH; i++) {
    const phase = getModulatedPhase(i, {
      phaseDistortion,
      fmAmount,
      fmRatio,
    })
    let value = 0

    for (let harmonic = 1; harmonic <= renderedPartialCount; harmonic++) {
      const gain =
        Math.pow(harmonic, -rolloff) *
        getOddEvenGain(harmonic, oddEvenBalance)
      value += gain * Math.sin(Math.PI * 2 * harmonic * phase)
    }

    samples[i] = value
  }

  return samples
}

function getClassicHarmonicGain(source: GeneratorSource, harmonic: number) {
  if (source === 'saw') {
    return (harmonic % 2 === 0 ? -1 : 1) / harmonic
  }

  if (source === 'square') {
    if (harmonic % 2 === 0) return 0
    return 1 / harmonic
  }

  if (source === 'triangle') {
    if (harmonic % 2 === 0) return 0
    const oddIndex = (harmonic - 1) / 2
    const polarity = oddIndex % 2 === 0 ? 1 : -1
    return polarity / (harmonic * harmonic)
  }

  return 0
}

function renderClassicSource(
  source: Exclude<GeneratorSource, 'additive'>,
  {
    partialCount,
    phaseDistortion,
    fmAmount,
    fmRatio,
  }: GeneratorParamValues,
) {
  const samples = new Float32Array(FRAME_LENGTH)
  const renderedPartialCount = getRenderedPartialCount(partialCount)

  for (let i = 0; i < FRAME_LENGTH; i++) {
    const phase = getModulatedPhase(i, {
      phaseDistortion,
      fmAmount,
      fmRatio,
    })
    let value = 0

    for (let harmonic = 1; harmonic <= renderedPartialCount; harmonic++) {
      const gain = getClassicHarmonicGain(source, harmonic)
      if (gain === 0) continue
      value += gain * Math.sin(Math.PI * 2 * harmonic * phase)
    }

    samples[i] = value
  }

  return samples
}

export function renderGeneratorFrame(params: GeneratorFrameParams) {
  const samples =
    params.source === 'additive'
      ? renderAdditiveSource(params)
      : renderClassicSource(params.source, params)

  applyOutputModifiers(samples, params)
  return samples
}
