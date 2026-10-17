---
name: FittForma AI
description: Tu progreso, en un solo lugar. A phone-first training app where every section wears its own colour on one shared component family.
colors:
  brand-blue: "#2f5fe8"
  brand-violet: "#6a4cf2"
  hero-navy: "#101d45"
  hero-indigo: "#2a1666"
  mod-train: "#0a68d6"
  mod-train-2: "#1b54d8"
  mod-train-ink: "#0b5cb4"
  mod-train-ink-dark: "#8ccaff"
  mod-plan-ink: "#2347b8"
  mod-plan-ink-dark: "#9bb6ff"
  mod-running: "#08786a"
  mod-running-2: "#0b6f86"
  mod-running-ink: "#07705f"
  mod-running-ink-dark: "#79e6d3"
  mod-nutrition: "#0a7a50"
  mod-nutrition-2: "#0c7d63"
  mod-nutrition-ink: "#08704a"
  mod-nutrition-ink-dark: "#86e6bd"
  mod-coach: "#5a3ed6"
  mod-coach-2: "#2a63d8"
  mod-progress-ink: "#4d32c4"
  mod-progress-ink-dark: "#c3b5ff"
  mod-community: "#bd2b84"
  mod-community-2: "#9b2bb0"
  mod-community-ink: "#a3226f"
  mod-community-ink-dark: "#ff9ad6"
  mod-profile: "#4f46e5"
  mod-profile-2: "#3a5be0"
  mod-profile-ink: "#3b33c4"
  mod-profile-ink-dark: "#b4b1ff"
  page: "#f3f6fb"
  panel: "#ffffff"
  panel-2: "#eef2f9"
  border: "rgba(30,50,100,.11)"
  text: "#0d1830"
  text-2: "#3b4764"
  text-3: "#56627e"
  page-dark: "#060b18"
  panel-dark: "#0d172e"
  panel-2-dark: "#13203d"
  border-dark: "rgba(120,150,220,.16)"
  text-dark: "#eef3ff"
  text-2-dark: "#b4c1dc"
  text-3-dark: "#8d9bbb"
  on-color: "#ffffff"
  ok: "#22c993"
  warn: "#f5a524"
  warn-text: "#8f5400"
  bad: "#ff6b6b"
  bad-text: "#bb2f2a"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
    fontFeature: "\"cv11\", \"ss01\""
  headline:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  body-sm:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.35
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
  stat:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
rounded:
  sm: "10px"
  field: "12px"
  md: "14px"
  tile: "18px"
  lg: "20px"
  hero: "24px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.on-color}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.mod-plan-ink}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
    height: "44px"
  pill-tabs:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "4px"
  pill-tab-active:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.on-color}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-nested:
    backgroundColor: "{colors.panel-2}"
    rounded: "{rounded.md}"
    padding: "10px"
  input:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    height: "44px"
  tag:
    textColor: "{colors.mod-plan-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  section-hero:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.on-color}"
    rounded: "{rounded.hero}"
    padding: "18px"
  nav-item-active:
    textColor: "{colors.mod-plan-ink}"
    rounded: "{rounded.md}"
    height: "58px"
  fab:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.on-color}"
    rounded: "{rounded.pill}"
    size: "56px"
---

# Design System: FittForma AI

## Overview

**Creative North Star: "One Kit, Seven Colours"**

FittForma AI is a phone-first training app whose sections (Inicio, Entrenar, Running, Nutrición, Progreso, Comunidad, Perfil, plus FittAI) each carry their own colour while sharing one component family. The same pill button, pill tab, rounded card and progress bar appear everywhere; only the module colour changes. That refuses the grey dashboard with a single accent: you always know which part of your training you are in by colour, and you never have to relearn a control.

Light is the default theme: a cool blue-white ground with white cards lifted by soft, blue-tinted shadows. Dark is a deep navy world with layered panels, a faint brand glow in the page background and neutral black shadows. Both themes keep identical geometry and component behaviour; only surfaces, ink tints and shadow colour swap. Density is phone-practical: generous rounded containers, 44px controls, short labels, and primary actions within one or two taps.

Real imagery carries the energy where it matters. Workout heroes use real gym photography under a dark navy overlay with white type in both themes, while charts, rings and progress bars take the module colour. Nothing decorates for its own sake: numbers come from logged data, and colour marks place and state.

**Key Characteristics:**
- One component family; colour is assigned per section through four variables (base, second stop, ink, soft tint).
- Pill-shaped actions and tabs; 18–24px rounded cards and heroes.
- Module gradient (135deg, base to second stop) on primary actions, active tabs, section heroes and progress fills.
- Light default with soft tinted shadows; dark navy alternative with neutral shadows.
- Photo heroes under dark overlays with white type, regardless of theme.
- Inter, self-hosted, heavy weights (700–800) with tight negative tracking on headings.

## Colors

A cool, saturated palette: brand blue to violet, one distinct hue per module, and neutrals tinted toward navy in both themes.

### Primary
- **Brand Blue** (brand-blue) and **Brand Violet** (brand-violet): the brand gradient at 135deg. It is the Inicio module colour, the floating + button, today's day in the week strip, the daily quote card, and the default for primary buttons outside any section (welcome, sheets).
- **Hero Navy to Hero Indigo** (hero-navy, hero-indigo): the Inicio greeting band, a 150deg navy-to-indigo gradient lit by soft cyan and magenta radial glows; white type sits on it in both themes.

### Secondary (module colours)
Each section sets its own base, second stop, ink (for text on the theme ground) and soft tint (base at roughly 10% alpha in light, 15–17% in dark). Base and second stop both carry white text at 4.5:1 or better.
- **Entrenar Blue** (mod-train, mod-train-2): routines, exercises, the training hub.
- **Running Teal** (mod-running, mod-running-2): GPS runs and outdoor activity.
- **Nutrición Green** (mod-nutrition, mod-nutrition-2): meals, water, macros.
- **Progreso Violet** (brand-violet with mod-coach as second stop): stats, badges, body.
- **FittAI Violet-Blue** (mod-coach, mod-coach-2): the coach chat and its proposals.
- **Comunidad Magenta** (mod-community, mod-community-2): feed, posts, messages.
- **Perfil Indigo** (mod-profile, mod-profile-2): profile and settings.
- Module inks have a light value (mod-*-ink) and a lighter dark-theme value (mod-*-ink-dark); text-coloured module elements (links, tags, secondary buttons, stat numbers) always use the ink, never the base.

### Neutral
- **Cool Paper** (page) and **Deep Night** (page-dark): page ground. Dark adds a fixed radial blue glow top-right and a violet glow left.
- **White Card** (panel) / **Night Panel** (panel-dark): card surface. Dark cards add a 3.5% white top sheen.
- **Mist Panel** (panel-2) / **Raised Night** (panel-2-dark): nested surfaces, inputs, stat tiles, habit rows.
- **Ink Navy** (text), **Slate** (text-2), **Muted Slate** (text-3), with dark counterparts: primary text, labels, and muted metadata.
- **Hairline** (border, border-dark): every card, field and tab tray edge.
- **Status**: ok, warn and bad for indicators; warn-text and bad-text are the light-theme legible forms used for text and outlines.

### Named Rules
**The Four Variables Rule.** A section's colour is expressed only through `--mod`, `--mod-2`, `--mod-ink` and `--mod-soft` set on its `#view-*` container. Components read those variables; they never hard-code a section hue.

**The White On Colour Rule.** Anything drawn on a module gradient, a photo hero or the navy greeting band (heading, body, status, button) is white, in both themes. Buttons inside a coloured hero become translucent outline pills.

**The Ink Not Base Rule.** Coloured text on the page ground uses the module ink for the current theme; the saturated base is reserved for fills behind white text.

## Typography

**Display Font:** Inter (self-hosted variable, weights 100–900, with system-ui fallback)
**Body Font:** Inter
**Label/Mono Font:** Inter; no second family.

**Character:** One neo-grotesque throughout, driven by weight rather than family. Headings are heavy and tightly tracked; body stays regular and readable at 16px. Character variants cv11 and ss01 are on globally.

### Hierarchy
- **Display** (800, 26px, 1.1): the greeting in the Inicio band and section hero titles.
- **Headline** (800, 24px, -0.03em): section headings above each view.
- **Title** (800, 17px, 1.35): card headings, list group heads.
- **Stat** (800, 28px, -0.03em): big numbers in charts and summaries; secondary units drop to 15px muted.
- **Body** (400, 16px, 1.45): running text and form values.
- **Body small** (500–600, 13px): card descriptions, list metadata, chips; 12.5px for compact rows.
- **Label** (700, 12px): buttons in dense rows, tab labels, nav labels (10.5–11px floor on the phone nav).

### Named Rules
**The Weight Carries Rank Rule.** Hierarchy is weight plus size: 800 for headings and numbers, 700 for actions and labels, 400–600 for reading text. Headings always take negative tracking (-0.02em to -0.03em).

**The 11px Floor Rule.** No UI text below 11px in either theme.

## Layout

Phone-first. Content sits in a single column with a 12–16px side gutter and extra bottom padding (150px plus safe area below 900px) so the fixed bottom nav and floating + button never cover the last action. Spacing follows a 4px-based scale (4, 8, 12, 16, 24, 32px); cards stack with 12–14px gaps.

- **Phone (below 900px):** sticky translucent header (logo, theme toggle, Más), a six-item bottom navigation bar, and a 56px floating + button bottom-right. Weekly stat tiles drop to two columns at 420px and below.
- **Tablet (900px and up):** several views (Entrenar, Nutrición, Perfil) become two equal columns; the exercise library grows from 2 to 3 columns.
- **Desktop (1024px and up):** the app becomes a grid with a 248px left rail (sticky, rounded tray of vertical nav items with an uppercase group label for tools) and a main column up to 1320px wide. Inicio becomes a 1.35fr / 1fr dashboard with habits and badges in the right column.
- **Wide (1200px and up):** the exercise library reaches 4 columns; Nutrición and Progreso summary panels split into two columns.

## Elevation & Depth

A hybrid of soft shadow and tonal layering. Cards sit one level up on a hairline border plus a small diffuse shadow; nested surfaces drop the shadow and step to the second panel tone instead. Coloured elements (primary buttons, active tabs, section heroes) cast a short shadow tinted with their own module colour in light theme; in dark theme those become neutral black shadows. Header and bottom nav are translucent with a 14px backdrop blur.

### Shadow Vocabulary
- **Card, light** (`box-shadow: 0 3px 10px rgba(22,40,90,.07)`): every card, tile, tab tray, theme toggle.
- **Card, dark** (`box-shadow: 0 4px 14px rgba(0,0,0,.28)`): same roles in dark.
- **Raised, light** (`box-shadow: 0 10px 28px rgba(22,40,90,.08)`) / **dark** (`0 10px 30px rgba(0,0,0,.35)`): larger floating surfaces.
- **Module lift** (`box-shadow: 0 8px 20px -8px var(--mod)`): under primary buttons in light theme; 0 6px 16px -8px for active pill tabs; 0 14px 30px -18px for section heroes.
- **Neutral lift, dark** (`box-shadow: 0 8px 20px -10px rgba(0,0,0,.7)`): replaces every module lift in dark.
- **Bottom nav** (`box-shadow: 0 -6px 24px rgba(10,20,50,.08)`).

### Named Rules
**The Nested Goes Flat Rule.** A card inside a card loses its shadow and takes the second panel tone. Rows inside a group (meals, recent activity) are separated by hairlines, never boxed again.

**The No Coloured Glow In The Dark Rule.** In dark theme, depth comes from neutral black shadows; module-tinted halos exist only in light theme.

## Shapes

Soft and round, never sharp. Actions, tabs, chips, tags, metadata pills and the favourite toggle are full pills (999px). Containers step through a small set of radii: 10–12px for icon chips and fields, 14–16px for habit rows, week days, stat tiles and meal icons, 18px for tiles and library cards, 20px for cards, 22–24px for heroes and the greeting band. Icon chips are rounded squares (10–12px radius) holding a 1.8–1.9px stroked line icon. Photos are clipped by their container's radius with square inner edges. Chat bubbles are 18px with the corner nearest the speaker cut to 6px.

## Components

### Buttons
Confident and tactile: a full pill carrying the module gradient.
- **Shape:** full pill (999px).
- **Primary:** 135deg gradient from module base to second stop, white 700-weight label, no border, module-tinted lift in light. Minimum 40–44px tall. Outside a section it falls back to brand blue to violet.
- **Secondary / Ghost:** transparent, 1.5px outline in the module base at 55% alpha, label in module ink.
- **On a coloured hero:** translucent dark fill (black 22%), 1.5px white outline at 55%, white label.
- **Disabled:** 55% opacity, no shadow.
- **Floating +:** 56px circle in the brand gradient, fixed bottom-right above the nav on phone only.

### Chips
- **Style:** pill; tags use the module soft tint with module ink text and no border.
- **State:** a selected chip fills with the module base and white text.

### Cards / Containers
- **Corner Style:** 20px (18px for tiles and library cards).
- **Background:** white card in light; night panel with a faint top sheen in dark.
- **Shadow Strategy:** the card shadow from Elevation; nested cards go flat on the second panel tone.
- **Border:** 1px hairline on every card.
- **Internal Padding:** 16px on phone, up to 22–24px on wide layouts.

### Inputs / Fields
- **Style:** second panel tone, 1px hairline, 12px radius; placeholder in muted text.
- **Focus:** 2px outline in the module base with 1px offset; the border goes transparent.
- **Checkboxes, radios, ranges:** browser controls tinted with the module base. File inputs get an outline pill button in module ink on the soft tint.

### Navigation
- **Pill tabs (subsections):** a white pill tray with 4px padding and hairline; inactive tabs are slate text on transparent; the active tab takes the module gradient with white text. Scrolls horizontally when it overflows.
- **Bottom nav (phone):** six items (Inicio, Entrenar, Nutrición, Progreso, Comunidad, Perfil), translucent panel with blur and a hairline top; muted icons with labels; the active item turns its own module ink on a 12% tint of that colour with a short indicator bar.
- **Left rail (desktop):** the same items stacked vertically in a 248px rounded tray, active item tinted in its module colour.
- **Header:** translucent page colour (88%) with 14px blur and a hairline bottom; logo, 40px rounded theme toggle, Más.

### Section Hero
The signature band at the top of each section: the module gradient (or a gym photo under a navy overlay), 22–24px radius, at least 118px tall, white title, subtitle and actions, with a soft left-side darkening for legibility.

### Progress, Rings and Charts
Progress bars use a 10% ink track and a module gradient fill. Rings use a matching gradient stroke on a 10% track. The weight line chart is a 3px rounded line in blue with hollow dots and dashed hairline gridlines. Macros keep fixed hues (green protein, blue carbs, amber fat) shown as a 9px dot beside each label.

### Icon Chips and Quick Tiles
Line icons sit in rounded-square chips tinted at about 14% of a category hue (training blue, food green, water cyan, activity violet, running teal), with a lighter icon colour in dark theme. Quick-action tiles are 18px cards with the icon chip above a bold label.

## Do's and Don'ts

### Do:
- **Do** set a section's colour only through its four module variables on the `#view-*` container and let components inherit.
- **Do** use the 135deg module gradient for every primary action, active pill tab, section hero and progress fill.
- **Do** keep text on any coloured or photo surface white, in both themes.
- **Do** use the module ink (not the base) for coloured text on the page ground, with the theme's own ink value.
- **Do** flatten nested surfaces: second panel tone, no shadow, hairline separators for rows.
- **Do** keep controls at 40–44px minimum height and UI text at 11px or larger.
- **Do** put real gym photos under a dark navy overlay with white type when a hero needs imagery.
- **Do** use stroked line icons (1.8–1.9px) inside rounded-square tinted chips.

### Don't:
- **Don't** hard-code a section hue inside a component; read `--mod`, `--mod-2`, `--mod-ink`, `--mod-soft`.
- **Don't** use coloured glows for depth in dark theme; use neutral black shadows.
- **Don't** box rows inside a card as cards again.
- **Don't** use square or small-radius buttons; actions are pills.
- **Don't** introduce a second typeface; Inter carries every role.
- **Don't** use text glyphs or emoji as icons; use inline SVG line icons.
