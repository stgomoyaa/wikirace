# WikiRace design system

Generated from `app/globals.css`. The CSS tokens are the source of truth.

## Direction

Editorial sport. WikiRace should feel like a race sheet crossed with a serious reference publication, not like wiki-race.com and not like raw Wikipedia.

The signature is the three-node route mark. It represents the actual product output: a path made from article links.

## Color tokens

| Token | Value |
| --- | --- |
| `--color-bg` | `oklch(0.955 0.008 245)` |
| `--color-surface` | `oklch(0.985 0.005 245)` |
| `--color-surface-2` | `oklch(0.925 0.012 245)` |
| `--color-line` | `oklch(0.78 0.015 245)` |
| `--color-ink` | `oklch(0.2 0.018 245)` |
| `--color-ink-soft` | `oklch(0.46 0.018 245)` |
| `--color-dark-line` | `oklch(0.38 0.018 245)` |
| `--color-on-dark` | `oklch(0.96 0.008 245)` |
| `--color-accent` | `oklch(0.62 0.205 32)` |
| `--color-accent-soft` | `oklch(0.9 0.055 32)` |
| `--color-danger` | `oklch(0.51 0.2 25)` |
| `--color-success` | `oklch(0.48 0.13 155)` |

The page uses cool paper and graphite ink. Signal orange is reserved for route rails, focus, active links and scores.

## Typography

| Token | Value |
| --- | --- |
| `--font-display` | `var(--font-display-loaded), sans-serif` |
| `--font-sans` | `var(--font-sans-loaded), sans-serif` |
| `--font-editorial` | `var(--font-editorial-loaded), serif` |

- Display: Teko for the wordmark, scores and game headings.
- Interface: IBM Plex Sans for controls, navigation and status.
- Article: Source Serif 4 for long-form Wikipedia content.

## Spacing

| Token | Value |
| --- | --- |
| `--space-3xs` | `0.125rem` |
| `--space-2xs` | `0.25rem` |
| `--space-xs` | `0.5rem` |
| `--space-sm` | `0.75rem` |
| `--space-md` | `1rem` |
| `--space-lg` | `1.5rem` |
| `--space-xl` | `2.5rem` |
| `--space-2xl` | `4rem` |
| `--space-3xl` | `6rem` |

## Product surfaces

- The setup screen is an asymmetric two-column track sheet on desktop and one column on mobile.
- The race HUD uses graphite with one orange route rail.
- Primary actions use graphite, not the accent as a large fill.
- Focus is immediate with a 3px orange outline.
- Motion is deliberately still except for loading state feedback.

## Wikipedia reader

- Only `body.innerHTML` is mounted. A full Wikipedia document is never nested inside the app.
- Inline Wikipedia styles are removed so this system controls presentation.
- References, navboxes, authority data and collapsed details are removed from race pages.
- Infoboxes float on desktop and become full-width on mobile.
- Figures, galleries, cladograms, data tables, hatnotes and disabled links each have explicit styles.

## Responsive rules

- Verify at 320, 375, 768 and 1280px.
- Navigation labels and actions stay on one line.
- Infoboxes and figures never exceed the viewport.
- `html` and `body` use `overflow-x: clip`.

## Do not

- Do not restore lime or indigo from the reference site.
- Do not restore the double-chevron logo.
- Do not reintroduce inline styles.
- Do not add gradients, glow, floating cards or emoji controls.
- Do not mount Wikipedia `html`, `head` or `body` elements inside the reader.
- Do not show navboxes, references or JavaScript-only collapsed lists during a race.
