# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-04-18

### Added
- Added incremental peaks-cache IPC endpoints in Electron main (`calculate-block-sizes`, `build-peaks-cache-level`) to support large-file waveform processing.
- Added crash and process-failure logging in Electron main for improved diagnostics.

### Changed
- Changed waveform cache generation in the editor viewport to build levels incrementally over IPC instead of one large payload.
- Changed peaks block-size growth strategy to reduce level count for large audio buffers.
- Changed local start script to enable Electron logging and stack dumping.

### Removed
- Removed the local `PERFORMANCE_OPTIMIZATIONS.md` planning document.
