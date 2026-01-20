# Wave Pimp - Audio Waveform Visualization Application

## Project Overview

An Electron desktop application for visualizing and editing audio waveforms. Built with React 19, TypeScript, and WaveSurfer.js. Features drag-and-drop audio file loading, waveform/spectrogram visualization, grid view of files, and a detailed editor view.

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Desktop**: Electron 30
- **Audio Visualization**: WaveSurfer.js 7.12.1, Spectrogram plugin
- **Build**: Vite 6.2.0, vite-plugin-electron, vite-plugin-svgr
- **Icons**: Material Symbols SVG (rounded, filled variants)
- **Styling**: Pure CSS with CSS variables for theming

## Code Style & Conventions

### Naming Conventions

- **Variables/Functions**: camelCase (e.g., `audioFiles`, `handlePlayPause`)
- **Components**: PascalCase (e.g., `WaveCard`, `DetailView`, `IconButton`)
- **CSS Classes**: kebab-case (e.g., `wave-card`, `detail-view-waveform`)
- **Files**: PascalCase for components (e.g., `WaveCard.tsx`), camelCase for utilities

### TypeScript

- Always use explicit types for props interfaces
- Prefer `interface` over `type` for component props
- Use `React.FC` sparingly; prefer explicit function declarations with typed props
- Enable strict mode
- No `any` types - use proper typing

### React Patterns

- **Hooks**: Always use `useCallback` for event handlers to prevent infinite re-renders
- **Refs**: Use `useRef` for DOM elements and mutable values that don't trigger re-renders
- **Effects**: Minimize dependencies in `useEffect` - only include what actually triggers re-creation
- **State**: Use `useState` for component-local state that triggers re-renders

### Critical WaveSurfer.js Patterns

**Working Implementation Pattern** (from WaveCard.tsx):

```typescript
useEffect(() => {
  if (!waveformRef.current || !spectrogramRef.current) return

  const ws = WaveSurfer.create({
    container: waveformRef.current,
    url: file.object_url,
    height: 120, // MUST match CSS height
    waveColor: theme.waveformColor,
    progressColor: theme.progressColor,
    cursorWidth: 1,
    cursorColor: theme.progressColor,
    interact: true,
  })

  ws.on('ready', () => {
    // Register spectrogram INSIDE ready callback
    if (spectrogramRef.current) {
      const spectrogramPlugin = Spectrogram.create({
        container: spectrogramRef.current,
        height: 120, // MUST match CSS height
        labels: false, // CRITICAL: labels: true breaks rendering
      })
      ws.registerPlugin(spectrogramPlugin)
    }
  })

  // Register other event listeners AFTER ready callback
  ws.on('play', () => setIsPlaying(true))
  ws.on('pause', () => setIsPlaying(false))
  ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()))
  ws.on('interaction', () => setCurrentTime(ws.getCurrentTime()))

  wavesurferRef.current = ws

  return () => {
    ws.destroy()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [file.object_url]) // ONLY file.object_url in deps
```

**Critical Rules for WaveSurfer**:

1. Heights in WaveSurfer.create() MUST exactly match CSS heights
2. Spectrogram `labels: false` - setting to `true` breaks rendering
3. Register spectrogram plugin in the `ready` callback, NOT before
4. Do NOT use `plugins: []` array in create options - use `registerPlugin()` in ready callback
5. Container CSS must NOT have `overflow-x: auto` or `overflow-y: hidden` - breaks spectrogram rendering
6. Dependency array should ONLY contain `[file.object_url]` to prevent unnecessary re-creation
7. Do NOT include theme colors in dependency array

### CSS Guidelines

**Theming**:

- Use CSS variables for all colors: `--background-color`, `--text-color`, `--muted-color`, etc.
- Light/dark mode via `@media (prefers-color-scheme: dark/light)`
- Icon fill color: `--icon-fill-color` (different per theme)

**Layout**:

- Use fixed pixel heights for WaveSurfer containers, NOT flex or percentages
- Prevent page scroll with `overflow: hidden` on html, body, and container elements
- Box-sizing: border-box for all elements

**Critical CSS for Detail View**:

```css
.detail-view-waveform {
  width: 100%;
  height: 300px; /* Fixed height - no flex */
  margin-bottom: 12px;
  background: var(--waveform-background-color);
  /* NO overflow properties! */
}

.detail-view-spectrogram {
  width: 100%;
  height: 250px; /* Fixed height - no flex */
  background: var(--background-color);
  /* NO overflow properties! */
}
```

## File Structure

```
/electron/
  main.ts          # Electron main process
  preload.ts       # Preload script

/src/
  App.tsx          # Main app component with drag-and-drop
  WaveCard.tsx     # Grid card showing waveform + spectrogram
  DetailView.tsx   # Full-screen editor view
  IconButton.tsx   # Material Symbols icon button component
  types.ts         # TypeScript interfaces
  index.css        # Global styles + theming
  vite-env.d.ts    # Type declarations for SVG imports
```

## Key Features Implemented

### Main App (App.tsx)

- Drag-and-drop audio file loading
- Grid view of loaded files
- Memoized callbacks to prevent infinite re-renders
- File rename with IPC to Electron main process
- Keyboard shortcuts (Delete, Cmd+S, Cmd+X, Escape)

### Wave Card (WaveCard.tsx)

- Waveform visualization (120px height)
- Spectrogram visualization (120px height)
- Inline filename editing with star indicator for unsaved changes
- Save/Cancel buttons appear inline when editing
- Play/pause/restart controls
- Edit and Remove buttons positioned absolutely in top-right corner (semi-transparent overlay)
- Fixed heights: 120px waveform, 120px spectrogram, controls, and info section

### Detail View (DetailView.tsx)

- Full-screen waveform editor (300px height)
- Spectrogram below waveform (250px height)
- Header with filename, metadata (duration, sample rate, channels), and close button
- Transport controls: Restart, Play/Pause, Skip to End
- Zoom controls: -/+ buttons with range 0 (fit) to 10,000 px/s in 100px increments
- Display: "Fit" when zoom=0, otherwise "Xpx/s"
- NO page scroll - fixed heights that fit in viewport
- Single-channel waveform (splitChannels removed for now)

### Icon Button (IconButton.tsx)

- Material Symbols icons (rounded, filled variants)
- Icons: Edit, Play, Pause, Restart, Remove, Save, ZoomIn, ZoomOut, Close, Cancel, Forward
- Styled with `--icon-fill-color` CSS variable
- Simple clsx utility for className merging

## Known Issues & Solutions

### Problem: Infinite Re-renders

**Solution**: Always wrap event handlers in `useCallback` with proper dependencies

### Problem: Spectrogram Not Rendering

**Causes**:

1. Using `labels: true` instead of `labels: false`
2. CSS has `overflow-x: auto` or `overflow-y: hidden`
3. Height mismatch between CSS and WaveSurfer options
4. Wrong dependency array causing re-creation before ready
5. Registering plugin before ready callback

**Solution**: Follow the exact WaveCard pattern above

### Problem: Page Scrolling

**Solution**:

```css
html {
  overflow: hidden;
}
body {
  overflow: hidden;
  height: 100vh;
}
#app {
  height: 100vh;
  overflow: hidden;
}
.detail-view {
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
}
```

### Problem: Window Not Draggable

**Solution**: Keep default frame, just set `backgroundColor: '#1a1a1a'` in Electron BrowserWindow options

## Current State

### Working:

- ✅ Frameless window with draggable frame
- ✅ Wave cards with waveform + spectrogram
- ✅ Detail view with waveform + spectrogram rendering
- ✅ Zoom functionality (0-10,000 px/s)
- ✅ Play/pause/restart/skip controls
- ✅ Inline filename editing with save/cancel
- ✅ Icon buttons with Material Symbols
- ✅ No page scroll in detail view

### Not Implemented:

- [ ] Stereo waveform (splitChannels) in detail view - removed for now
- [ ] Waveform/spectrogram filling remaining height (currently fixed 300px/250px)
- [ ] Trimming/editing functionality
- [ ] Export functionality

## Important Reminders

1. **NEVER** modify WaveSurfer useEffect dependency arrays without understanding the impact
2. **NEVER** add overflow CSS to waveform/spectrogram containers
3. **ALWAYS** use fixed pixel heights for WaveSurfer containers
4. **ALWAYS** set `labels: false` for spectrogram
5. **ALWAYS** register spectrogram in ready callback, not before
6. **NEVER** include theme colors in WaveSurfer useEffect dependencies
7. When the user says "it's not working", ask what specifically isn't working and check browser console
8. When making layout changes, ensure page scroll is disabled with overflow: hidden

## Debug Checklist

When waveform/spectrogram doesn't render:

1. Check browser console for errors
2. Inspect DOM - is canvas element being created?
3. Check CSS height matches WaveSurfer height option
4. Check CSS has NO overflow properties
5. Check spectrogram has `labels: false`
6. Check plugin registered in ready callback
7. Check dependency array only has `[file.object_url]`
