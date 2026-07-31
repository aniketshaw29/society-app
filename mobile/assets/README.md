# Required App Assets

Replace these placeholder files before building for production. All files must be
committed to the repository so EAS Build can find them.

## Asset Table

| File | Size | Description |
|---|---|---|
| `icon.png` | 1024×1024 px | App icon. No transparency. Used on iOS and as base for Android. |
| `splash.png` | 1242×2436 px | Splash / launch screen. Green background `#1B6B3A`, logo centred. |
| `adaptive-icon.png` | 1024×1024 px | Android adaptive icon foreground layer (logo on transparent background). |
| `notification-icon.png` | 96×96 px | Android notification icon — **white icon on transparent background** only. |
| `favicon.png` | 32×32 px | Web favicon (only needed if targeting web). |

## Brand Colours

| Token | Hex | Usage |
|---|---|---|
| Primary Green | `#1B6B3A` | Splash background, buttons, adaptive icon background |
| Light Green | `#4CAF50` | Success states, online indicators |
| Background | `#F3F4F6` | Screen backgrounds |
| Text | `#111827` | Primary text |
| Muted | `#6B7280` | Secondary text, subtitles |

## How to Generate Placeholder Assets

### Option 1 — Expo online tool
Visit https://buildicon.netlify.app/ to generate a complete icon set from a single
source image, then export each asset at the sizes above.

### Option 2 — EAS image processing
```bash
npx expo-optimize --quality 80
```

### Option 3 — Manual with ImageMagick
```bash
# App icon (green background + white "SA" text)
convert -size 1024x1024 xc:#1B6B3A \
  -fill white -font Helvetica-Bold -pointsize 420 \
  -gravity center -draw "text 0,0 'SA'" icon.png

# Notification icon (white square on transparent — tweak as needed)
convert -size 96x96 xc:transparent \
  -fill white -draw "rectangle 20,20 76,76" notification-icon.png
```

## iOS App Store Requirements
- Icon must **not** have rounded corners or transparency (App Store adds rounding automatically).
- Use sRGB colour space.

## Android Requirements
- `adaptive-icon.png` foreground must have **safe zone padding** — keep logo within the
  central 66% of the canvas (approximately 680×680 px at 1024 px total).
- `notification-icon.png` must be **entirely white** on a transparent background.
  Android tints the icon with the `color` value from `app.config.ts`.
