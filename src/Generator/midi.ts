const MIDI_NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

function getMidiNoteLabel(note: number) {
  const name = MIDI_NOTE_NAMES[note % MIDI_NOTE_NAMES.length]
  const octave = Math.floor(note / MIDI_NOTE_NAMES.length) - 1
  return `${name}${octave}`
}

export function getMidiNoteFrequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12)
}

export function formatMidiNoteDisplay(note: number) {
  return `${note} ${getMidiNoteLabel(note)} ${getMidiNoteFrequency(note).toFixed(2)} Hz`
}
