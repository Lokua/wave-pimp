# Generator Future Modes

The first procedural generator ships only fixed-length frames: mono, 2,048
samples, at the app sample rate. That keeps the generated material immediately
useful as Tonverk wavetable frames and avoids mixing pitch-tuned cycle behavior
with frame-size behavior.

## Cycle Mode

Cycle mode should generate pitch-tuned single-cycle waveforms for looping
sampler and granular workflows. In this mode the sample length is derived from
pitch and sample rate, for example C2 at 44.1 kHz is about 674 samples. That is
useful for oscillator-style sample playback, but it is not a fixed-size
wavetable frame.

## Sweep Mode

Sweep mode should generate a multi-frame wavetable source by varying one or
more generator parameters across a frame count. A first pass could sweep
rolloff, harmonic count, odd/even balance, or phase mode across 64 frames, add
those frames to Files, and optionally open Assemble with them preselected.

## Shared Rules

- Frame mode keeps exact frame size as the primary invariant.
- Cycle mode keeps musical pitch as the primary invariant.
- Sweep mode should produce exact same-length frames so Assemble can concat
  without length warnings.
