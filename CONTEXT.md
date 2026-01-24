# Frontend Code Style Guidelines

## General

1. **Indentation**: Use consistent 2-space or 4-space indentation. Do not align
   properties, array elements, or parameters to match previous lines. Each
   nested level gets one indent only.

   ```
   // GOOD - consistent block indentation
   const params = {
     resolution: [width, height, 0, 0],
     colors: [1, 0, 0, 1],
     values: [x, y, z, w],
   }

   // BAD - aligning to match previous line lengths
   const params = {
     resolution: [width, height, 0, 0],
     colors:     [1,     0,      0, 1], // Don't do this!
     values:     [x,     y,      z, w], // Don't do this!
   }
   ```

2. **Line length**: Keep lines under 80-100 characters where practical.
3. **Imports**: Group imports by external libraries, then internal modules,
   separated by blank lines.
4. **Naming**:
   - Use descriptive names. Avoid meaningless prefixes like "handle"; prefer
     `onChangeValue` over `handleValue`.
   - Use camelCase for variables and functions, PascalCase for components.
5. **Formatting**: Use Prettier or your project's formatter defaults.
6. **Comments**: Use `//` for line comments. Place comments above the line they
   pertain to, never on the same line as code.
7. **Ordering**: Place main logic and exported components at the top. Helper
   functions and utilities go at the bottom.

## React/TypeScript

1. **Component Naming**: Use PascalCase for component names.
2. **Props and State**: Type all props and state with TypeScript interfaces or
   types.
3. **Event Handlers**: Use `on<Event><Target>` naming convention, e.g.,
   `onClickFoo`, `onChangeBar`.
4. **No Implicit Returns for Side Effects**: Do not use implicit returns for
   functions that don't return a value. Not that this does NOT mean to not use
   arrow functions
5. Expand object literals.

   ```js
   // don't
   onChange={e => setEditValue(e.target.value)}

   // do
   onChange={e => {
     setEditValue(e.target.value);
   }}
   ```

6. **JSX Formatting**: Keep JSX readable. Break up long props or children onto
   multiple lines if needed.
7. **Hooks**: Use the `use` prefix for custom hooks. Place hooks at the top of
   your component body.

## CSS

1. **Class Naming**: Use BEM or another consistent naming convention.
2. **Avoid Inline Styles**: Prefer CSS modules, styled-components, or external
   stylesheets.

# CSS

- Use recess ordering which generally follows the box model: positioning,
  display that impacts the outside world, display that impacts in the inside
  world, then details that don't impact sizing like colors, text alignment, etc.
