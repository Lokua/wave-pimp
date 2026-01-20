# Virtual MIDI Controller (VMC)

An Electron app I whipped up to aid in local development. Sends CCs to any MIDI
output on your system.

# Features

- Ability to select output port
- Set channel
- Toggle between regular or high-resolution CCs for CCs 0-31 (inclusive)
- Adapts to your system's Dark/Light theme preference
- TODO: different range display modes (float, percentage, etc)

![Light Theme](./assets/vmc-light.png)

![Dark Theme](./assets/vmc-dark.png)

# Status

The app is working locally as well as when built on a Mac. An installer for
MacOS is in the
[release section](https://github.com/Lokua/vmc/releases/tag/0.0.0-beta).
Building for other operating systems should be as easy as:

```sh
# or `npm` if not using bun, though why wouldn't you?
bun install
bun run build
```
