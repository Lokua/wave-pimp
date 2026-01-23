# Code Style Guidelines

1. **Indentation**: Use consistent block-level indentation only. DO NOT align
   parameters, struct fields, or array elements to match previous lines. Each
   nested level gets one indent, period.

   ```rust
   // GOOD - consistent block indentation
   let params = ShaderParams {
       resolution: [wr.w(), wr.h(), 0.0, 0.0],
       colors: [1.0, 0.0, 0.0, 1.0],
       values: [x, y, z, w],
   };

   // BAD - aligning to match previous line lengths
   let params = ShaderParams {
       resolution: [wr.w(), wr.h(), 0.0, 0.0],
       colors:     [1.0,    0.0,    0.0,  1.0],  // Don't do this!
       values:     [x,      y,      z,    w],    // Don't do this!
   };
   ```

2. **Line length**: Keep lines under 80 characters where practical
3. **Imports**: Group by std/external/internal, separated by blank lines
4. **Naming**:
   - Do not use meaningless names like "handle" as a prefix; it doesn't communicate anything useful Especially in react, onChangeThis is preferred over handle
5. **Formatting**: Use `rustfmt` defaults (already configured).
6. **Comments**: Use `//` for line comments, `///` for doc comments. ever, ever
   place comments on the same line as code. Always place them above the line
   they pertain to.
7. **Control variables**: Prefer using `var: a1`, `var: b2` etc. in YAML for
   shader-bound parameters (matches the uniform bank convention)
8. **Ordering**: Follow the "main up top" organizational pattern. Code is read
   from top to bottom in order of importance and use. Utility and implementation
   details go at the bottom. For example if a fragment main uses an `fbm`
   function, and that uses a `hash` function, the order would be `fs_main`
   followed by `fbm` and then `hash`

## Rust Specific

Do not use `get_` within structs when a simple name would do. e.g. `rgb_flat` instead of `get_rgb_flat`

# React

Do not use implicit returns for functions that's don't return anything.

```js
// don't
onChange={(e) => setEditValue(e.target.value)}

// do
onChange={(e) => {
  setEditValue(e.target.value)
}}
```

Use `on<Event><Target>` naming convention, so `onClickFoo` and `onClickBar`, never `onBarClick`, this isn't programming with Yoda.

# CSS

- Use recess ordering which generally follows the box model: positioning, display that impacts the outside world, display that impacts in the inside world, then details that don't impact sizing like colors, text alignment, etc.
