# Loading Light Theme Design

## Goal

Add a native light appearance to the full-screen LinChat boot sequence while
preserving its current structure, motion, responsive layout, and dark theme.

## Visual Direction

The light variant uses a cool laboratory-console aesthetic:

- pearl-white and pale blue-green page surfaces;
- a translucent white instrument panel with precise gray-blue borders;
- deep teal primary text and quieter steel-blue metadata;
- cyan, coral, gold, and green signals retained as functional accents;
- restrained shadows and grid lines so the screen remains technical without
  looking washed out.

## Theme Resolution

The loading screen follows the app's existing theme classes.

- `.light` always selects the light palette.
- `.dark` keeps the existing dark palette.
- before the persisted app theme has hydrated, `prefers-color-scheme` provides
  the initial fallback so the first frame is not always dark.

No new theme state or duplicate loading component is introduced.

## Implementation

Light-theme SCSS mixins will override only visual tokens and surfaces for the
existing loading elements. DOM structure, animation keyframes, accessibility
attributes, preview mode, and reduced-motion handling remain unchanged.

The light overrides cover:

- full-page background, perspective grid, and scanline overlay;
- boot panel surface, border, corner guides, and scan sweep;
- core crosshair, rings, scan beam, and logo frame;
- heading, caption, telemetry labels, progress tracks, and loading bars.

## Verification

- Add a regression assertion for explicit light-theme and system-theme fallback
  selectors.
- Keep the existing loading regression suite passing.
- Run SCSS/TS formatting and lint checks.
- Let the user visually verify both themes through `?loading-preview=1`.
