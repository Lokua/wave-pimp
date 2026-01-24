# Performance Optimization Plan

## Current Performance Issues

### File Drop (227ms for 110MB file) ✅ Acceptable
- Metadata parsing: 15ms
- ArrayBuffer conversion: 64ms
- Audio decoding: 148ms

### Editor Mount (1076ms) ⚠️ **PRIMARY BOTTLENECK**
- **`buildPeaksCache`: 1061ms** ← Blocks UI thread
- Everything else: ~15ms combined

### WaveCard Mount (per file) ⚠️ **WASTEFUL**
- Calls `buildPeaksCache` with same MAX_CACHE_WIDTH (7680) as Editor
- Canvas is likely ~400-800px wide (much less than 7680)
- Builds full multi-level pyramid when only needs 1-2 levels for that width

## Optimization Roadmap

### Phase 1: Critical - Offload Peaks Building to Main Process

**Priority: HIGH** - Editor is completely blocked for 1+ second

**Implementation:**
1. Move `buildPeaksCache` to main process (Electron/Node.js)
2. Create IPC handler: `ipc:build-peaks-cache`
3. Add loading state/spinner in Editor while peaks are building
4. Return peaks cache via IPC to renderer
5. Optional: Add progress updates during building (0-100%)

**Files to modify:**
- Create `src-electron/peaksBuilder.ts` (or similar)
- Modify `src/WaveEditor/useViewport.ts` - request peaks via IPC
- Modify `src/WaveEditor/Editor.tsx` - add loading state
- Add IPC handlers in main process

**Benefits:**
- UI stays responsive during peaks building
- User sees progress indicator
- No more 1+ second freeze

---

### Phase 2: WaveCard Optimization

**Priority: MEDIUM** - Wasteful but less critical than Editor freeze

**Problem:**
- WaveCard calls `buildPeaksCache(audioBuffer, 7680)` (line 168)
- Card canvas is likely only ~400-800px wide (much less than 7680)
- Building pyramid down to 7680px width is overkill for narrow card preview

**Solutions (pick one):**

#### Option A: Single-level peaks for cards
- Create `buildSimplePeaks(audioBuffer, targetWidth)` function
- Only compute one level of min/max at target width
- Much faster for card previews
- WaveCard uses simple peaks, Editor uses full cache

#### Option B: Shared peaks cache
- Build peaks once during file drop
- Store in AudioFile object
- Both WaveCard and Editor reuse same cache
- Requires Phase 1 to avoid blocking during drop

#### Option C: Lazy card peaks
- Don't build peaks until card is scrolled into view
- Use IntersectionObserver
- Show placeholder waveform until peaks ready

**Recommendation:** Option A (simplest, fastest for cards)

---

### Phase 3: Audio Decoding Optimization (Optional)

**Priority: LOW** - 148ms is noticeable but not terrible

**Current:**
- `audioCtx.decodeAudioData()` runs on renderer thread
- Blocks for ~148ms per file

**Possible improvement:**
- Offload to main process or Web Worker
- Likely minimal gain since Web Audio API is already optimized
- Consider only if Phase 1 & 2 don't provide enough improvement

---

## Success Metrics

### Before:
- Editor mount: ~1060ms (frozen UI)
- WaveCard mount: ~1060ms per card (frozen UI)
- Multiple cards = multiple freezes

### After Phase 1:
- Editor mount: ~15ms + async peaks building
- UI responsive during peaks building
- Loading indicator shows progress

### After Phase 2:
- WaveCard mount: ~50-100ms (estimated)
- No freeze on card render
- Multiple cards render smoothly

---

## Implementation Notes

### Phase 1 Considerations:
- Main process has access to full Node.js, no Web Audio API
- Need to transfer AudioBuffer data via IPC (structured clone)
- Consider using `Float32Array` transfer for efficiency
- Cache built peaks to avoid rebuilding on zoom

### Phase 2 Considerations:
- Card canvas width varies with window size
- May need to rebuild on resize (debounce)
- Consider caching simple peaks per file

### IPC Performance:
- Transferring large Float32Arrays is fast with structured clone
- Peaks cache is much smaller than raw audio data
- For 19M samples, peaks cache is ~few MB max
