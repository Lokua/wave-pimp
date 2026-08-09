import { createRequire } from 'node:module'

import type { WebContents } from 'electron'

const require = createRequire(import.meta.url)
const READ_SIZE_BYTES = 16384
const RENDER_BATCH_SAMPLES = 1024
const SCOPE_TRACE_COUNT = 4

type PortAudioDevice = {
  id: number
  name: string
  maxInputChannels: number
  maxOutputChannels: number
  defaultSampleRate: number
  hostAPIName: string
}

type NativeReadResult = {
  buf?: Buffer
  err?: string
  finished?: boolean
}

type NativeAudioStream = {
  start: () => void
  read: (byteCount: number) => Promise<NativeReadResult>
  quit: (mode: 'WAIT' | 'ABORT') => Promise<void>
}

type PortAudioBinding = {
  getDevices: () => PortAudioDevice[]
  create: (options: {
    inOptions: {
      channelCount: number
      closeOnError: boolean
      deviceId: number
      framesPerBuffer: number
      sampleFormat: number
      sampleRate: number
    }
  }) => NativeAudioStream
}

export type ScopeInputDevice = {
  id: number
  name: string
  maxInputChannels: number
  defaultSampleRate: number
}

function loadPortAudio() {
  return require(
    'naudiodon2/build/Release/naudiodon.node',
  ) as PortAudioBinding
}

export default class ScopeCapture {
  private binding: PortAudioBinding | null = null
  private stream: NativeAudioStream | null = null
  private target: WebContents | null = null
  private generation = 0
  private channelCount = 0
  private traces = Array.from({ length: SCOPE_TRACE_COUNT }, (_, index) => ({
    channel: index,
    enabled: true,
  }))
  private channelPhase = 0
  private byteRemainder = Buffer.alloc(0)
  private outputs = Array.from(
    { length: SCOPE_TRACE_COUNT },
    () => new Float32Array(RENDER_BATCH_SAMPLES),
  )
  private outputLengths = new Uint16Array(SCOPE_TRACE_COUNT)
  private transition: Promise<void> = Promise.resolve()

  listInputDevices(): ScopeInputDevice[] {
    return this.getBinding()
      .getDevices()
      .filter((device) => device.maxInputChannels > 0)
      .map((device) => ({
        id: device.id,
        name: device.name,
        maxInputChannels: device.maxInputChannels,
        defaultSampleRate: device.defaultSampleRate,
      }))
  }

  start(options: {
    target: WebContents
    deviceId: number
    traces: Array<{ channel: number; enabled: boolean }>
  }) {
    return this.enqueue(() => this.startNow(options))
  }

  private async startNow({
    target,
    deviceId,
    traces,
  }: {
    target: WebContents
    deviceId: number
    traces: Array<{ channel: number; enabled: boolean }>
  }) {
    await this.stopNow()

    const device = this.listInputDevices().find(
      (candidate) => candidate.id === deviceId,
    )
    if (!device) throw new Error('The selected audio input is unavailable.')
    this.validateTraces(traces, device.maxInputChannels)

    const stream = this.getBinding().create({
      inOptions: {
        channelCount: device.maxInputChannels,
        closeOnError: true,
        deviceId: device.id,
        framesPerBuffer: 256,
        sampleFormat: 1,
        sampleRate: device.defaultSampleRate,
      },
    })

    this.target = target
    this.stream = stream
    this.channelCount = device.maxInputChannels
    this.traces = traces.map((trace) => ({ ...trace }))
    this.resetBuffers()
    const generation = ++this.generation
    stream.start()
    void this.pump(stream, generation)

    return {
      channelCount: device.maxInputChannels,
      sampleRate: device.defaultSampleRate,
    }
  }

  setTraces(traces: Array<{ channel: number; enabled: boolean }>) {
    this.validateTraces(traces, this.channelCount)
    this.traces = traces.map((trace) => ({ ...trace }))
    this.outputs = Array.from(
      { length: SCOPE_TRACE_COUNT },
      () => new Float32Array(RENDER_BATCH_SAMPLES),
    )
    this.outputLengths.fill(0)
  }

  stop() {
    return this.enqueue(() => this.stopNow())
  }

  private async stopNow() {
    const stream = this.stream
    this.stream = null
    this.target = null
    this.channelCount = 0
    this.generation += 1
    this.resetBuffers()
    if (!stream) return

    try {
      await stream.quit('ABORT')
    } catch {
      // The native stream may already be closed after a device error.
    }
  }

  private getBinding() {
    this.binding ??= loadPortAudio()
    return this.binding
  }

  private enqueue<T>(operation: () => Promise<T>) {
    const result = this.transition.then(operation, operation)
    this.transition = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private resetBuffers() {
    this.channelPhase = 0
    this.byteRemainder = Buffer.alloc(0)
    this.outputs = Array.from(
      { length: SCOPE_TRACE_COUNT },
      () => new Float32Array(RENDER_BATCH_SAMPLES),
    )
    this.outputLengths.fill(0)
  }

  private validateTraces(
    traces: Array<{ channel: number; enabled: boolean }>,
    channelCount: number,
  ) {
    if (traces.length !== SCOPE_TRACE_COUNT) {
      throw new Error('Scope requires four trace configurations.')
    }
    for (const trace of traces) {
      if (
        !Number.isInteger(trace.channel) ||
        trace.channel < 0 ||
        trace.channel >= channelCount
      ) {
        throw new Error('A selected input channel is unavailable.')
      }
    }
  }

  private async pump(stream: NativeAudioStream, generation: number) {
    try {
      while (this.stream === stream && this.generation === generation) {
        const result = await stream.read(READ_SIZE_BYTES)
        if (result.err) throw new Error(result.err)
        if (result.finished) break
        if (result.buf?.length) this.consume(result.buf)
      }
    } catch (error) {
      if (this.stream !== stream || this.generation !== generation) return
      const message = error instanceof Error ? error.message : String(error)
      if (this.target && !this.target.isDestroyed()) {
        this.target.send('scope-error', message)
      }
      await this.stop()
    }
  }

  private consume(chunk: Buffer) {
    const data = this.byteRemainder.length
      ? Buffer.concat([this.byteRemainder, chunk])
      : chunk
    const completeLength = data.length - (data.length % 4)

    for (let offset = 0; offset < completeLength; offset += 4) {
      const sample = data.readFloatLE(offset)
      for (let traceIndex = 0; traceIndex < this.traces.length; traceIndex++) {
        const trace = this.traces[traceIndex]
        if (!trace.enabled || this.channelPhase !== trace.channel) continue
        const outputLength = this.outputLengths[traceIndex]
        this.outputs[traceIndex][outputLength] = sample
        this.outputLengths[traceIndex] = outputLength + 1
        if (this.outputLengths[traceIndex] === RENDER_BATCH_SAMPLES) {
          this.sendOutput(traceIndex)
        }
      }
      this.channelPhase = (this.channelPhase + 1) % this.channelCount
    }

    this.byteRemainder = Buffer.from(data.subarray(completeLength))
  }

  private sendOutput(traceIndex: number) {
    if (this.target && !this.target.isDestroyed()) {
      this.target.send(
        'scope-samples',
        traceIndex,
        this.outputs[traceIndex].buffer,
      )
    }
    this.outputs[traceIndex] = new Float32Array(RENDER_BATCH_SAMPLES)
    this.outputLengths[traceIndex] = 0
  }
}
