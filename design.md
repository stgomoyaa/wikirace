# WikiRace design system

Generated from `app/globals.css`. The CSS tokens are the source of truth.

## Direction

Warm, playful race interface inspired by Wikipedia navigation. The surface is lime, the ink is indigo, and the double-chevron mark represents moving through article links.

## Color tokens

| Token | Value |
| --- | --- |
| `--color-bg` | `oklch(0.965 0.125 112)` |
| `--color-bg-strong` | `oklch(0.935 0.16 112)` |
| `--color-paper` | `oklch(0.985 0.018 110)` |
| `--color-paper-muted` | `oklch(0.955 0.035 110)` |
| `--color-ink` | `oklch(0.37 0.19 272)` |
| `--color-ink-strong` | `oklch(0.3 0.19 272)` |
| `--color-ink-soft` | `oklch(0.52 0.12 272)` |
| `--color-article-ink` | `oklch(0.25 0.03 272)` |
| `--color-danger` | `oklch(0.54 0.2 28)` |
| `--color-success` | `oklch(0.48 0.13 155)` |

## Typography

| Token | Value |
| --- | --- |
| `--font-display` | `var(--font-display-loaded), sans-serif` |
| `--font-sans` | `var(--font-sans-loaded), sans-serif` |
| `--font-editorial` | `Georgia, 'Times New Roman', serif` |

- Display: Krona One for the wordmark and primary headings.
- Interface: IBM Plex Sans for controls, navigation and status.
- Article: Georgia for long-form Wikipedia content.

## Spacing

| Token | Value |
| --- | --- |
| `--space-2xs` | `0.25rem` |
| `--space-xs` | `0.5rem` |
| `--space-sm` | `0.75rem` |
| `--space-md` | `1rem` |
| `--space-lg` | `1.5rem` |
| `--space-xl` | `2rem` |
| `--space-2xl` | `3rem` |
| `--space-3xl` | `4rem` |

## Interaction

- Primary actions use the highest-contrast indigo fill.
- Focus is immediate with a 3px outline.
- Active buttons move down by 1px; buttons never jump on hover.
- Motion is limited to one short screen entrance and the loading spinner.
- Reduced-motion mode collapses all motion to 1ms.

## Responsive rules

- Verify at 320, 375, 768 and 1280px.
- Navigation labels and actions stay on one line.
- The article becomes edge-to-edge below 700px.
- `html` and `body` use `overflow-x: clip`.

## Do not

- Do not add a second accent or neutral grey literals.
- Do not reintroduce inline styles.
- Do not round cards or buttons into pills.
- Do not add gradients, glow, floating cards or emoji controls.
- Do not wrap the form in a separate elevated card.
