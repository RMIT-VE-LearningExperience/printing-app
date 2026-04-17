# Print App — Style Guide

**Project:** Print App CMS System
**Framework:** Next.js + Material UI (MUI) v5
**Last Updated:** April 15, 2026

---

## Table of Contents

1. [Colour Palette](#1-colour-palette)
2. [Typography](#2-typography)
3. [Spacing & Shape](#3-spacing--shape)
4. [Elevation & Shadows](#4-elevation--shadows)
5. [Buttons](#5-buttons)
6. [Dialogs](#6-dialogs)
7. [Tables](#7-tables)
8. [Cards](#8-cards)
9. [Form Fields](#9-form-fields)
10. [Iconography](#10-iconography)
11. [Sidebar (CMS Admin)](#11-sidebar-cms-admin)
12. [Footer](#12-footer)
13. [Status Indicators](#13-status-indicators)
14. [Page Backgrounds](#14-page-backgrounds)

---

## 1. Colour Palette

### Primary

| Token | Hex | Usage |
|---|---|---|
| Primary | `#3D8078` | Buttons, links, active states, progress bar, icon accents |
| Primary Dark (hover) | `#2e6159` | Hover state for primary buttons and interactive elements |
| Primary Subtle | `rgba(61, 128, 120, 0.1)` | Hover backgrounds on cards and nav items |
| Primary Active BG | `rgba(61, 128, 120, 0.25)` | Active/selected nav item backgrounds in sidebar |

### Neutrals

| Token | Hex | Usage |
|---|---|---|
| Dark BG / Text | `#45443F` | Primary text, dark backgrounds (sidebar, footer) |
| Secondary Text | `#62615C` | Secondary text, subtitles, muted labels |
| Muted Text | `#C2BDB1` | Inactive sidebar items, placeholder icons |
| Border | `#A19A8C` | Standard borders |
| Light Border | `#E5E1D7` | Dividers, card borders, dialog separators |
| Light BG | `#FDF9F1` | Page backgrounds, dialog headers/footers |
| Card BG / White | `#FFFFFF` | Card surfaces, dialog content areas |

### Semantic

| Token | Hex | Usage |
|---|---|---|
| Success | `#1A7A2E` | Success alerts, "Saved" confirmation text |
| Error | `#C4321A` | Error alerts, unpublish toggle (red state) |
| Warning | `#f59e0b` | Warning indicators (e.g. QR slug outdated) |
| Publish Green | `#135b22` | Published toggle thumb colour |
| Publish Green Track | `#b3d3b9` | Published toggle track colour |
| Unpublish Red | `#C4321A` | Unpublished toggle thumb colour |
| Unpublish Red Track | `#efc9c2` | Unpublished toggle track colour |
| Canvas Embed BG | `#EEF2FF` | Canvas LMS instruction box background |
| Canvas Embed Text | `#3730a3` / `#4338ca` | Canvas LMS instruction text |

### Footer

| Token | Hex | Usage |
|---|---|---|
| Footer BG | `#45443F` | Footer background (both user-facing and admin) |
| Footer Text | `#ffffff` | Footer text and links |

---

## 2. Typography

**Font Family:** `Roboto, "Helvetica Neue", Arial, sans-serif`

Fonts are scaled responsively via MUI's `responsiveFontSizes()`.

### Type Scale

| Variant | Size | Weight | Line Height | Notes |
|---|---|---|---|---|
| `h1` | 3rem | 800 | 1.1 | Letter spacing: -0.02em |
| `h2` | 2.5rem | 800 | 1.15 | Letter spacing: -0.02em |
| `h3` | 2rem | 700 | 1.2 | |
| `h4` | 1.75rem | 700 | 1.25 | |
| `h5` | 1.25rem | 700 | 1.3 | Section headings in CMS |
| `h6` | 1.1rem | 600 | 1.4 | Dialog titles |
| `subtitle1` | 1rem | 500 | 1.5 | |
| `subtitle2` | 0.875rem | 600 | 1.5 | |
| `body1` | 1rem | 400 | 1.6 | |
| `body2` | 0.875rem | 400 | 1.5 | Table content, secondary info |
| `caption` | 0.75rem | 400 | 1.4 | Labels, helper text, monospace URLs |
| `overline` | 0.75rem | 800 | 1.4 | Letter spacing: 0.1em, uppercase |
| `button` | 0.875rem | 600 | — | Letter spacing: 0.02em, `textTransform: none` |

### Key Rules
- **Never use `textTransform: "uppercase"` on buttons** — the theme sets `textTransform: "none"` globally for buttons.
- Dialog titles use `variant="h6"` at `fontWeight: 700`, `color: "#3D8078"`, `fontSize: "1.1rem"`.
- Section headings in the CMS use `variant="h5"` at `color: "#45443F"`, `fontWeight: 700`.
- Monospace text (URLs, embed code) uses `fontFamily: "monospace"`, `fontSize: "0.75rem"`.

---

## 3. Spacing & Shape

### Border Radius

| Context | Value |
|---|---|
| Global theme default | `12px` |
| Cards (user-facing) | `8px` |
| Dialog / modal paper | `borderRadius: 2` (16px) |
| Buttons in sidebar | `borderRadius: 1` (8px) |
| Back/breadcrumb nav items | `borderRadius: "6px"` |
| Code / URL blocks | `borderRadius: 2` (16px) |
| Image placeholders | `borderRadius: "6px"` or `"8px"` |

### Spacing Patterns

- **Dialog padding:** `py: 2.5` for title, `px: 3 pt: 2 pb: 2` for actions
- **Dialog content top padding:** always override with `paddingTop: "24px !important"` to counteract MUI's internal reset
- **Section `mb` before tables/content:** `mb: 3`
- **Stack spacing in dialogs:** `spacing: 2`

---

## 4. Elevation & Shadows

| Context | Shadow |
|---|---|
| Cards (user-facing, default) | `0 2px 8px rgba(69, 68, 63, 0.08)` |
| Cards (user-facing, hover) | `0 8px 16px rgba(69, 68, 63, 0.12)` |
| Dialogs / modals | `0 8px 32px rgba(0,0,0,0.12)` |
| Login card | `0 2px 8px rgba(0,0,0,0.1)` |
| Admin footer (angled clip) | `drop-shadow(-3px 0 6px rgba(0,0,0,0.10))` |

---

## 5. Buttons

### Primary (Contained)

```
backgroundColor: "#3D8078"
"&:hover": { backgroundColor: "#2e6159" }
textTransform: "none"
fontWeight: 600
```

Used for: "Save", "Copy Link", "Download", "Copy Embed Code", "Submit".

### Secondary / Text

```
color: "#3D8078"
fontWeight: 600
textTransform: "none"
```

Used for: "Close", "Cancel", "Back to Login" — always placed to the right of a primary action in dialog `DialogActions`.

### Danger / Destructive

```
color: "#C4321A"  (text button)
```

Used for: "Delete", "Reject" actions — typically a text button, never contained.

### Dialog Action Layout

- Primary action: `variant="contained"` with `flex: 1` to fill available space
- Secondary action: text button, fixed width, to the right
- Always wrapped in `DialogActions` with `gap: 1`, `px: 3`, `py: 2`, `backgroundColor: "#FDF9F1"`, `borderTop: "1px solid #E5E1D7"`

### In-Sidebar Save Button

```
fontSize: "0.7rem"
backgroundColor: "#3D8078"
textTransform: "none"
```

---

## 6. Dialogs

All dialogs share a consistent structure:

### Paper Props
```
borderRadius: 2
boxShadow: "0 8px 32px rgba(0,0,0,0.12)"
```

### Title (`DialogTitle`)
```
backgroundColor: "#FDF9F1"
borderBottom: "2px solid #E5E1D7"
py: 2.5
```
- Title text: `variant="h6"`, `fontWeight: 700`, `color: "#3D8078"`, `fontSize: "1.1rem"`
- Subtitle (item name): `variant="body2"`, `color="text.secondary"`

### Content (`DialogContent`)
```
paddingTop: "24px !important"
backgroundColor: "#ffffff"
```

### Actions (`DialogActions`)
```
borderTop: "1px solid #E5E1D7"
pt: 2, pb: 2, px: 3
backgroundColor: "#FDF9F1"
gap: 1
```

### Sizing
| Dialog Type | `maxWidth` |
|---|---|
| QR Code preview | `xs` |
| Copy Link, Embed | `sm` |
| Edit/Add modals | `sm` or `md` |
| Information dialogs | `xs` or `sm` |

---

## 7. Tables

### Container
```
TableContainer > Paper: elevation 0, border: "1px solid #E5E1D7", borderRadius: 2
```

### Header Row (`TableHead`)
```
backgroundColor: "#FDF9F1"
TableCell: fontWeight: 700, color: "#45443F", fontSize: "0.8rem"
```

### Body Rows
```
TableRow hover: backgroundColor: "#FDF9F1" (via sx or MuiTableRow-root hover)
TableCell: variant="body2", color="text.secondary" for secondary fields
```

### Action Icons (per row)
Ordered consistently: `MoreVertIcon` (menu) → `ContentCopyIcon` (copy link) → `QrCodeIcon` (QR) → `SettingsEthernetIcon` (embed)

All icon buttons: `size="small"`, `onClick` must call `e.stopPropagation()`.

---

## 8. Cards (User-Facing)

```
borderRadius: "8px"
border: "none"
backgroundColor: "#FFFFFF"
boxShadow: "0 2px 8px rgba(69, 68, 63, 0.08)"
overflow: "hidden"
```

Hover state:
```
boxShadow: "0 8px 16px rgba(69, 68, 63, 0.12)"
cursor: "pointer"
```

### Thumbnail Area
```
backgroundColor: "#FDF9F1"   (image container bg)
fallback placeholder bg: "#E5E1D7"
placeholder icon: <ImageIcon sx={{ color: "#C2BDB1", fontSize: 40 }} />
```

### Card Text
- Name: `fontWeight: 600`, `color: colors.text` (`#45443F`)
- Description/secondary: `color: colors.lightText` (`#62615C`)

---

## 9. Form Fields

All TextFields use MUI defaults with the following conventions:

- `size="small"` in the CMS admin
- `label` always provided (no placeholder-only fields)
- Character counters via `InputAdornment` on fields with `maxLength`
- Section Title fields: `minWidth: 260, maxWidth: "50%"`

### Code / URL Display Blocks (read-only)
```
backgroundColor: "#f9f9f9"
borderRadius: 2
border: "1px solid #E5E1D7"
p: 2
fontFamily: "monospace"
fontSize: "0.75rem"
wordBreak: "break-all"
color: "#45443F"
```

---

## 10. Iconography

All icons from **`@mui/icons-material`**. Standard size is `fontSize="small"` in tables/toolbars; `fontSize: 24` in sidebar navigation.

| Icon | Component | Usage |
|---|---|---|
| Home | `HomeIcon` | Home navigation |
| More options | `MoreVertIcon` | Row action menus |
| Copy link | `ContentCopyIcon` | Copy link per printer |
| QR code | `QrCode2 as QrCodeIcon` | QR code per printer |
| Embed | `SettingsEthernet as SettingsEthernetIcon` | Canvas LMS embed |
| Delete | `DeleteOutlineIcon` | Delete actions |
| Drag | `DragIndicatorIcon` | Reorder handles |
| Info | `InfoIcon` | Information dialogs |
| Visibility | `VisibilityIcon` | Preview mode |
| Approve | `CheckCircleOutline as ApproveIcon` | Approve requests |
| Reject | `CancelOutlined as RejectIcon` | Reject requests |
| Logout | `LogoutIcon` | Admin logout |

---

## 11. Sidebar (CMS Admin)

```
backgroundColor: "#45443F"
width: collapsed = ~60px, expanded = 240px (approximate)
```

### Text & Icons
```
color: "#E5E1D7"           — labels and dividers
color: "#C2BDB1"           — inactive nav items
color: "#3D8078"           — active accent / teal highlight
color: rgba(255,255,255,0.6) — muted secondary text
```

### Nav Item States
```
default:  color: "#C2BDB1", backgroundColor: "transparent"
hover:    backgroundColor: "rgba(255, 255, 255, 0.1)"
active:   color: "#FDF9F1", backgroundColor: "rgba(61, 128, 120, 0.25)"
```

### Dividers
`color: "#E5E1D7"` (light divider on dark background)

---

## 12. Footer

| Context | Style |
|---|---|
| User-facing | Full-width bar, `backgroundColor: "#45443F"`, `color: "#ffffff"`, `padding: "10px 24px"`, centered text |
| CMS Admin | Fixed bottom-right, angled left edge via `clipPath: "polygon(32px 0, 100% 0, 100% 100%, 0 100%)"`, same colours |

Both: `fontSize: 14px`, `fontWeight: 500`, `letterSpacing: 0.3px`, `zIndex: 10`

---

## 13. Status Indicators

### Publish Toggle (MUI Switch)
```
checked (published):
  thumb: "#135b22"
  track: "#b3d3b9"

unchecked (unpublished):
  thumb: "#C4321A"
  track: "#efc9c2"
```

### Alert / Feedback
- `severity="success"` — green, used for form submission confirmations
- `severity="error"` — red, used for validation and API errors
- Success alerts in the CMS auto-close after **3 seconds**
- Copy/Saved confirmations use inline button text change (e.g. "Copied!", "Saved") with a **2-second** reset

### QR Warning State
When a printer slug has been updated after a QR was generated:
```
IconButton sx: { color: "#f59e0b" }
```

---

## 14. Page Backgrounds

| Page | Background |
|---|---|
| User-facing app | `#FDF9F1` |
| CMS Admin main content | `#FFFFFF` |
| Login page | `#FDF9F1` |
| Dialog headers & action bars | `#FDF9F1` |
| Dialog content areas | `#FFFFFF` |
| Table headers | `#FDF9F1` |
| Code / URL blocks | `#f9f9f9` |
| Sidebar | `#45443F` |
| Footer | `#45443F` |
