# Bulk Mode + Concat into Wavetable — Design Plan

Design notes for the first version of bulk-file selection in wave-pimp. The
single shipped action in this version is **Concat into Wavetable**, intended
specifically for producing wavetable files for the Elektron Tonverk. Generic
file concatenation is not a goal.

This doc captures decisions made during planning. Implementation details that
aren't decided are listed at the bottom under "Open implementation questions".

---

## Goal

Let the user select multiple `.wav` files in click order from the sidebar and
concatenate them into a single wavetable file, where the click order determines
the frame order in the resulting wavetable.

Wavetable players (including Tonverk) generally expect every frame in the
wavetable to be the same sample length and the file to be in a single uniform
format. The UX is built around helping the user notice when their selection
doesn't meet that expectation, without forcing them to fix it.

---

## Mode model

There is a single app-level boolean: `bulkMode`. Outside bulk mode, the
sidebar behaves exactly as it does today (click for focus, load icon to push
into the editor). Inside bulk mode, the sidebar takes over the entire window.

### Entering

- A toggle button in the sidebar header. That is the only entry point in v1.

### Exiting

- Clicking the same toggle button again
- Pressing `Esc`
- Auto-exit on successful Apply

### Layout in bulk mode

When bulk mode is active, the right pane (the WaveEditor) **disappears** and
the sidebar grows to fill the entire window. This gives much more room for the
file grid and makes selection easier. The grid lays out in multiple columns
rather than a single vertical strip.

A bulk-mode toolbar sits at the top, mirroring the structural pattern of the
WaveEditor's toolbar.

The currently-loaded editor file (if any) is preserved in state and restored
when bulk mode exits. Unsaved editor edits are not a concern for this feature
right now — edits are destructive on an in-memory copy and there is no
undo/redo, so no warning or prompt is needed on entry or exit.

---

## Selection semantics in bulk mode

- Clicking an unselected card adds it to the selection at the next position
  (`1`, then `2`, then `3`...).
- Clicking an already-selected card removes it and **renumbers** the remaining
  selections so they stay contiguous.
- The "load into editor" icon on each card is hidden or disabled in bulk mode
  to remove ambiguity about what clicks do.
- Selection is not preserved across bulk-mode entry/exit. Exiting throws it
  away.

### Visual

Each selected card shows:
- A small **numbered badge** in the top-right corner (`1`, `2`, `3` ...) in
  click order.
- The existing focus-border treatment (re-purposed as "in selection").

---

## The Concat into Wavetable action

This is the only action shipped in v1. The full flow:

1. User enters bulk mode and clicks files in their desired frame order.
2. User clicks **Concat into Wavetable** in the bulk toolbar.
3. A standard Save As dialog appears (default filename `wavetable.wav`,
   default location = folder of the first selected file).
4. On confirm, every selected file is coerced to the **app-wide output
   format** from `SettingsModal` (`settings.sampleRate` + `settings.bitDepth`)
   and written end-to-end into a single new wave file in click order.
5. Bulk mode exits. The new file is added to the sidebar file list and
   auto-loaded into the WaveEditor.

There is no per-Concat format picker. The output format is whatever the
user has set globally in Settings — same behavior as the editor's Save /
Save As. The bulk toolbar shows the current target format (e.g.
*"Will export as 24-bit / 48 kHz · change in Settings"*) so the user knows
what they're getting before they click Apply.

### Format mismatch handling

Source files do not need to match each other. They are all coerced to the
app-wide output format from Settings. The settings are the spec; the
sources adapt to them.

Channels: **mono only** in v1. The bulk panel does not show a channels
control. If a stereo source slips in, downmix to mono. (Stereo wavetables can
be added later if needed.)

### Length mismatch handling

Length-uniformity is checked **at the target sample rate** (since resampling
changes sample counts). If the selected files do not all have the same length
at the target rate, a neutral warning strip appears in the bulk toolbar:

> Selected files have different sample lengths (e.g. 1024, 2048).
> Wavetable players typically require uniform frame size.

The warning is informational only. Apply is **not** blocked — the user is
trusted to know whether their intent matches.

The warning never claims a "correct" length and never flags individual files
as outliers. It only reports the observed distinct lengths.

---

## Bulk toolbar

Left to right:

- **Exit** (back arrow or X)
- **"N selected"** count
- *(if applicable)* Length-mismatch warning strip
- **"Concat into Wavetable"** button, right-aligned, disabled when fewer than
  2 files are selected

---

## State plumbing (rough)

Hoist into `App.tsx` alongside the existing `files` / `editorFileId` /
`sidebarSelectedFileId`:

- `bulkMode: boolean`
- `bulkSelection: string[]` — ordered file IDs
- `previousEditorFileId: string | null` — for restoring the editor on exit

`WaveCard` learns whether it is in bulk mode and what its 1-based position in
`bulkSelection` is (or `undefined` if unselected).

`WaveGrid` swallows clicks during bulk mode and routes them to a
`toggleBulkSelection(id)` callback that handles append / remove + renumber.

`App.tsx` chooses between rendering the existing two-pane layout and the
full-window bulk view based on `bulkMode`.

No new state-management dependency. Everything fits the existing
local-state-and-callbacks pattern.

---

## Implementation notes

- The actual concat / resample / requantize work should run in the **Electron
  main process**, alongside `peaksBuilder.ts`. The renderer should not block
  on this, especially for large source files.
- The new file's peaks should be built by the same pipeline that builds peaks
  for any other file — invoke the existing `peaksBuilder` on the freshly
  written output rather than producing peaks during the concat itself.
- Output format is read from app-wide `settings` (the same `Settings` shape
  read by the editor's save). No per-Concat format dialog is built; if a
  reusable format dialog is wanted later, it can be added once and adopted
  by both editor save and Concat.
- Reuse the existing Save As flow used by the editor (`save-wav` IPC channel
  in `electron/main.ts`).

### Audio precision

When coercing source samples to the target format, do the math in **float32**
(or float64 for very long signals) and only quantize at write-out to the
target bit depth. This avoids quantization-leak noise when intermediate ops
(resampling, gain) are performed at native bit depth.

Pure copy paths (e.g. when source format already matches target) don't need
this — no math is happening. But anything involving multiplication, addition,
or interpolation does.

---

## Out of scope for v1 / future work

These were discussed and explicitly deferred:

- Other bulk actions (Normalize, Trim Start/End, etc.). The toolbar is built
  in a way that they can be added later without rearranging.
- Stereo wavetables / channel selection. Mono only for now.
- Configurable inter-frame silence or crossfades.
- Drag-to-reorder of selected files (the only re-ordering path today is
  exit-and-restart, or remove-and-re-click-at-end).
- Preview of the resulting wavetable waveform inside the bulk panel before
  saving.
- Auto-detecting Tonverk's specific frame-size expectations (typical
  wavetable players use 2048 samples per frame; confirm whether Tonverk
  diverges).
- Loading non-wav source files. v1 assumes `.wav` only.

---

## Open implementation questions

These don't need an answer to start, but should be settled during
implementation:

- What should happen if coercion or write fails partway through Apply?
  Suggested default: abort entirely, show the error, stay in bulk mode so the
  user can retry without re-selecting.
- Progress indication for long Concat ops (likely needed for big selections).
- Multi-column grid layout — fixed column count or responsive to window width?
- Should the bulk toolbar show any aggregate stats (total output duration,
  total output size) alongside the warning? Useful but optional.
