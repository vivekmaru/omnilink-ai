---
name: OmniLink AI
description: Linear × Raycast inspired personal knowledge repository & AI link hub
colors:
  primary: "#d97757"
  primary-hover: "#c46243"
  primary-dark: "#e08264"
  neutral-bg: "#f8f9fa"
  neutral-bg-dark: "#0e0e10"
  neutral-sidebar: "#f1f3f5"
  neutral-sidebar-dark: "#151518"
  neutral-card: "#ffffff"
  neutral-card-dark: "#1b1b1f"
  neutral-ink: "#111827"
  neutral-ink-dark: "#f9fafb"
  neutral-muted: "#4b5563"
  neutral-muted-dark: "#9ca3af"
  neutral-border: "#e9ecef"
  neutral-border-dark: "rgba(255, 255, 255, 0.08)"
typography:
  display:
    fontFamily: "'Newsreader', Georgia, Cambria, 'Times New Roman', serif"
    fontSize: "clamp(2rem, 5vw, 3.25rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.08em"
  micro:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: "10px"
    fontWeight: 600
rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System: OmniLink AI

## Overview

**Creative North Star: "The Linear Scholar"**

OmniLink AI combines the high-density keyboard-driven speed of **Linear & Raycast** with the deep editorial sanctuary of modern reading tools. The interface prioritizes instant information scanning, structured metadata tags, and crisp semantic typography while remaining completely distraction-free.

### Key Characteristics
- **Terracotta Accent Mastery**: Warm terracotta (`#d97757` / `#e08264`) anchors focus, selection, and AI actions without visual fatigue.
- **Duality of Voices**: Precision sans (`Outfit`) for high-speed triage alongside editorial serif (`Newsreader`) for long-form reading.
- **Subtle Surface Layering**: Tonal background contrasts with micro 1px translucent borders (`rgba(255, 255, 255, 0.08)`) instead of heavy dropped shadows.
- **Keyboard-First Rhythm**: Sub-100ms transitions, clear focus rings, and dedicated monospace shortcut badges.

## Colors

The palette employs deep obsidian darks and clean crisp neutrals punctuated by a warm terracotta signature accent.

### Primary
- **Terracotta Focus** (`#d97757` light / `#e08264` dark): Used for primary action buttons, active tab indicators, selected highlights, and AI status badges.
- **Deep Terracotta Hover** (`#c46243` light / `#e9957a` dark): Interactive hover and press states.

### Neutral
- **Canvas Base** (`#f8f9fa` light / `#0e0e10` dark): Main backdrop canvas.
- **Sidebar Surface** (`#f1f3f5` light / `#151518` dark): Left navigation drawer and contextual tool rails.
- **Elevated Card Surface** (`#ffffff` light / `#1b1b1f` dark): Bookmarks grid items, modal dialogs, and reader mode viewports.
- **Primary Ink** (`#111827` light / `#f9fafb` dark): High-contrast titles, body text, and headlines.
- **Muted Ink** (`#4b5563` light / `#9ca3af` dark): Secondary metadata, domain captions, and date stamps.

### Named Rules
**The Focused Accent Rule.** Terracotta accent is strictly reserved for user-directed focus, active states, and AI badges. It must never coat more than 8% of the viewport area.

## Typography

**Display / Reader Font:** `Newsreader`, Georgia, serif  
**Interface Sans Font:** `Outfit`, -apple-system, sans-serif  
**Technical & Nav Font:** `JetBrains Mono`, monospace  

**Character:** Balanced duality between high-velocity engineering ergonomics and distraction-free academic typography.

### Hierarchy
- **Display** (400, `clamp(2rem, 5vw, 3.25rem)`, 1.15): Reader mode article headlines and featured titles.
- **Headline** (600, `1.5rem`, 1.25): Modal titles, command palette headings, section headers.
- **Title** (600, `1.125rem`, 1.35): Bookmark card titles and cluster headings.
- **Body** (400, `0.9375rem`, 1.55): Card summaries, notes, and general UI text.
- **Label / Mono** (600, `0.6875rem`, uppercase, `0.08em` spacing): Category tags, shortcut badges, domain pills.

## Layout

A fluid 3-column responsive grid with an adaptive left rail (`240px`), flexible main stream (`max-w-7xl`), and full-bleed distraction-free overlays (`max-w-3xl`) for Reader Mode and Ask AI modals. Spacing follows an 8px rhythm (8px, 16px, 24px, 32px).

## Elevation & Depth

Surfaces rely on tonal step-ups and fine 1px borders rather than heavy blur shadows.

### Shadow Vocabulary
- **Card Rest**: `box-shadow: 0 1px 3px rgba(0,0,0,0.05)` (subtle ambient grounding).
- **Hover Lift**: `box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px var(--card-hover-border)`.
- **Modal Overlay**: `box-shadow: 0 20px 48px rgba(0,0,0,0.35)` with backdrop blur `12px`.

### Named Rules
**The Quiet Surface Rule.** In dark mode, depth is expressed by lightening the background surface luminosity by 3–5% per tier rather than increasing shadow opacity.

## Shapes

- **Base Radius:** 8px (`rounded-md`) for cards, search inputs, and action buttons.
- **Micro Radius:** 4px (`rounded-sm`) for tags, category pills, and shortcut keycaps.
- **Container Radius:** 12px–16px (`rounded-xl`) for modal dialogs and flyout drawers.

## Components

### Buttons
- **Shape:** 8px radius (`rounded-md`).
- **Primary:** Terracotta background with white bold text; scales up 1.02 on hover with 150ms ease.
- **Ghost / Secondary:** Transparent background with subtle border and muted ink text; hovers to `bg-white/5` (dark) or `bg-black/5` (light).

### Cards / Bookmark Containers
- **Corner Style:** 8px radius with 1px border.
- **Hover State:** Border transitions to terracotta glow (`--card-hover-border`), subtle 2px Y-translation.

### Inputs & Search Bars
- **Style:** Inset background (`--input-bg`), 1px border, monospace placeholder cues (`⌘K`).
- **Focus:** 1px ring with terracotta tint, zero harsh browser outline.

## Do's and Don'ts

### Do:
- **Do** maintain strict WCAG AA contrast (≥ 4.5:1) for all body text in both dark and light modes.
- **Do** provide monospace keyboard shortcut indicators (`⌘K`, `J/K`, `ESC`) next to primary actions.
- **Do** use `Newsreader` serif exclusively for Reader Mode body and display headlines.

### Don't:
- **Don't** apply harsh saturated blue or neon highlights; stay within the refined Terracotta and neutral palette.
- **Don't** clutter bookmark cards with more than 3 visible tags by default; collapse overflow into a `+N` badge.
- **Don't** use heavy drop shadows without a bounding border in dark mode.
