---
name: Conversational Clarity
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1c1c'
  surface-container: '#202020'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bccac2'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#303030'
  outline: '#86948d'
  outline-variant: '#3d4a44'
  surface-tint: '#61dbb4'
  primary: '#61dbb4'
  on-primary: '#00382a'
  primary-container: '#12a480'
  on-primary-container: '#003024'
  inverse-primary: '#006c52'
  secondary: '#c6c6c6'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#ffb4aa'
  on-tertiary: '#5f140f'
  tertiary-container: '#dc7265'
  on-tertiary-container: '#560d09'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7ff8cf'
  primary-fixed-dim: '#61dbb4'
  on-primary-fixed: '#002117'
  on-primary-fixed-variant: '#00513d'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4aa'
  on-tertiary-fixed: '#410001'
  on-tertiary-fixed-variant: '#7e2b22'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit-2xs: 0.25rem
  unit-xs: 0.5rem
  unit-sm: 0.75rem
  unit-md: 1rem
  unit-lg: 1.25rem
  unit-xl: 1.5rem
  unit-2xl: 2rem
  gutter-screen: 1rem
  composer-height: 3.5rem
---

## Brand & Style

This design system embodies pure utility, high-density focus, and conversational immediacy. Rooted in refined modern minimalism, the aesthetic eliminates visual noise so user thought and AI synthesis remain the focal point.

Key attributes:
- **Calm Authority**: The interface functions as an unobtrusive canvas—restrained, precise, and immediately legible.
- **Fluid Efficiency**: Rapid scanning, seamless interaction loops, and clear micro-affordances designed natively for single-thumb mobile ergonomics.
- **Intelligent Focus**: Subtle elevation layers and soft-edged pill controls demarcate structure without drawing attention away from streamed text or code blocks.

## Colors

The palette leverages high-contrast, deep-surface neutrals to preserve battery life on mobile OLED displays while providing extreme optical comfort during sustained reading.

- **Primary (`#10a37f`)**: Reserved strictly for high-value confirmations, active generation indicators, and voice mode cues. Never applied to large surface fills.
- **Secondary (`#ececec`)**: Primary text color in dark mode, rendering crisp typography with zero color distortion.
- **Neutral Base (`#212121`)**: Canvas foundation for viewports and chat streams.
- **Neutral Elevated (`#2f2f2f`)**: Composer docking bars, sheet drawers, active popovers, and pill buttons.
- **Neutral Subtle (`#424242`)**: Inactive controls, code block headers, and secondary pill states.
- **Subtle Stroke (`rgba(255, 255, 255, 0.08)`)**: Hairline dividers defining message cards, sheets, and bottom navigation bars.

## Typography

Typography prioritizes continuous readability across long-form generations, tabular data, and synthetic markdown rendering.

- **Prose Rendering**: Set `body-md` (15px / 22px line-height) as default for AI output and user message bubbles.
- **Code Hierarchies**: Code spans use `code-md` (`JetBrains Mono`) with isolated inline highlighting or structured block styling with monospace headers.
- **Display Weights**: Semibold weights (`600`) are reserved for empty state onboarding headings and modal titles to avoid visual fatigue.

## Layout & Spacing

The mobile layout utilizes an edge-to-edge vertical stream optimized for viewport transitions, software keyboard adjustments, and variable dynamic islands/safe areas.

- **Chat Stream Padding**: 16px (`unit-md`) horizontal safe gutter with dynamic top padding factoring in the system status bar and minimal navigation header.
- **Vertical Flow Rhythm**: Distinct prompt-response pairs separate by 24px (`unit-xl`), while adjacent user interactions maintain a tighter 8px (`unit-xs`) group offset.
- **Docked Composer**: Anchored to the viewport bottom with 8px to 12px safe bottom inset padding, automatically offsetting child scroll views to eliminate overlap during conversational generation.

## Elevation & Depth

Visual hierarchy uses flat tonal stratification layered with subtle frosted transparency rather than heavy dropped shadows.

- **Level 0 (Canvas Base)**: `#212121` base background.
- **Level 1 (Docked Bars & Sheets)**: `#2f2f2f` with a 1px border stroke (`rgba(255, 255, 255, 0.08)`).
- **Level 2 (Active Modals & Floating Pills)**: `#383838` paired with ambient blur (`backdrop-filter: blur(16px)`) and a diffuse shadow (`0px 4px 20px rgba(0, 0, 0, 0.35)`).
- **Code & Quote Insets**: Recessed `#181818` containers with smooth corner radiuses and high-contrast semantic syntax tokens.

## Shapes

The design system uses a pill-first (`roundedness: 3`) geometry for interactable controls, prompt chips, and docked text fields, while structural containers maintain modern soft radiuses.

- **Pill Controls (`rounded-full` / 9999px)**: Applied to conversational action chips, audio mode triggers, user message bubbles, and primary CTA buttons.
- **Surfaces & Cards (`1.25rem` / 20px)**: Applied to context sheets, custom modal overlays, and code block enclosures.
- **Micro Elements (`0.5rem` / 8px)**: Tooltips, inline badges, and secondary contextual action menus.

## Components

### Input Composer
- Continuous rounded-pill dock container background `#2f2f2f`.
- Expandable multiline input area supporting 1 to 6 auto-growing lines before vertical scroll lock.
- Right-aligned circular action button: neutral off-state (disabled arrow) transitioning to solid white circle with dark arrow or `#10a37f` when input is valid.
- Left-aligned attachment and voice triggers styled as ghost icon buttons (`color: #8e8e8e`, active state `#ececec`).

### Message Bubbles
- **User Prompt**: Right-aligned, encapsulated in `#2f2f2f` background with full pill rounded corners (20px) and a subtle inset margin.
- **Assistant Response**: Full-width edge-to-edge transparent alignment with zero container pill to maximize markdown, code, and table density.

### Action Chips & Suggestion Pills
- Outlined pill architecture: 1px border (`rgba(255, 255, 255, 0.12)`), `#212121` background, transitioning to `#2f2f2f` on active press.
- Compact vertical height (32px), containing single-line label typography (`label-sm`).

### Code Enclosures
- Darkened background `#181818` with top metadata bar housing language indicator (uppercase `label-sm`) and "Copy Code" ghost action.
- Content set in `JetBrains Mono` with soft-wrapped or horizontal scroll options.

### Floating Utility Bar
- Micro-pill action bar below completed AI responses containing: Copy, Regenerate, Thumbs Up, and Thumbs Down ghost icon buttons with 24px bounding boxes.