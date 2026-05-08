import { FRAME_LENGTH } from './constants'

export type AdditiveFrameParams = {
  harmonicCount: number
  rolloff: number
  oddEvenBalance: number
  phaseDistortion: number
  fmAmount: number
  fmRatio: number
  drive: number
  fold: number
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

export function renderAdditiveFrame({
  harmonicCount,
  rolloff,
  oddEvenBalance,
  phaseDistortion,
  fmAmount,
  fmRatio,
  drive,
  fold,
}: AdditiveFrameParams) {
  const samples = new Float32Array(FRAME_LENGTH)

  for (let i = 0; i < FRAME_LENGTH; i++) {
    const phase = modulatePhase(
      distortPhase(i / FRAME_LENGTH, phaseDistortion),
      fmAmount,
      fmRatio,
    )
    let value = 0

    for (let harmonic = 1; harmonic <= harmonicCount; harmonic++) {
      const gain =
        Math.pow(harmonic, -rolloff) *
        getOddEvenGain(harmonic, oddEvenBalance)
      value += gain * Math.sin(Math.PI * 2 * harmonic * phase)
    }

    samples[i] = value
  }

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

  return samples
}
