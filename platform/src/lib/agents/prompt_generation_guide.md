# TheStatsAndStacks — Premium Visual Prompt Playbook

This document serves as the design play-book and instruction set for generating ultra-premium, luxury, and informative visual assets for our personal finance brand on Instagram. All visual prompts must strictly adhere to these guidelines to ensure a cohesive, high-end editorial aesthetic.

---

## 1. Core Brand Aesthetics
- **Positioning**: Faceless, data-first, objective, and analytical.
- **Tone**: Professional, intellectual, calm, and authoritative.
- **Aesthetic**: Modern editorial (resembling *The Economist*, *Financial Times*, or *Monocle* print infographics).
- **Color Palette**: High contrast. Mostly deep dark backgrounds (`#09090D`, `#050505`) with vibrant, singular neon accent colors. Light mode uses clean, bright backgrounds (`#F8F9FA`) with dark grey text.

---

## 2. Style Guidelines

### A. Camera & Lens Specifications
To instruct the image generation model (e.g. Seedance) to produce photographic, non-AI-slop imagery, always specify high-end camera bodies and prime lenses:
- **Portraits/Archetypes**: `Shot on Hasselblad H6D-100c, f/2.8 or f/4, shallow depth of field`.
- **Cinematic/Metaphors**: `ARRI Alexa 65 anamorphic, cinematic color grading, 35mm lens`.
- **Editorial Product/Infographic**: `Phase One IQ4, crisp focus, tilt-shift lens`.
- **Film Emulation**: `Kodak Portra 400` (for warm lifestyle), `Cinestill 800T` (for night/neon scenes), or `Ilford HP5` (for B&W gravitas).

### B. Lighting Playbook
Avoid generic flat lighting. Specify structured, dramatic lighting setups:
- **Key Light**: `Rembrandt rim lighting` (for dramatic portraits), `Kino Flo softbox` (for clean products).
- **Mood Light**: `Warm golden-hour window light`, `low-angle Mediterranean sunset`, `cool twilight blue mixed with warm tungsten desk glow`.
- **Contrast**: Maintain a 7:1 contrast minimum between text/main subject and the background.

### C. Premium Materials & Textures
Always name specific materials instead of generic words like "metal" or "wood":
- **Metals**: `brushed titanium`, `oxidized brass`, `polished platinum`.
- **Stone**: `polished Calacatta marble`, `slate`, `raw concrete`.
- **Wood**: `smoked oak`, `polished walnut`, `rosewood`.
- **Paper/Textiles**: `matte paper with subtle grain texture`, `heavy cardstock`, `black velvet`.

---

## 3. Composition & Layout Constraints

### A. The 40% Negative Space Rule
All slides must maintain at least 40% negative space to prevent the canvas from looking cluttered. This space is where clean, crisp text overlays will reside.

### B. Standard Layouts
- **Top-Third Layout**: Text elements sit in the top 30% of the canvas in a stacked, centered block. The main visual subject occupies the lower 70%.
- **Split-Column Layout**: Visual subject on one side (left or right 50%), and text overlays on the opposite side in spacious negative space.
- **Center Layout**: Centered visual subject with clean, balanced text overlays above or below it.

### C. Negative Prompt (What to Avoid)
To avoid generic AI slop, explicitly forbid:
- Glassmorphism panels or floating translucent glass cards.
- Bright purple-blue gradient backgrounds (generic SaaS/crypto aesthetic).
- Floating geometric blobs or random 3D spheres/cylinders.
- Stock-photo clichés (e.g., corporate handshakes, smiling multicultural business teams).
- Emoji decorations or cartoon icons.
- Midjourney CLI flags (e.g., `--ar 4:5`, `--style raw`) as they break Seedance.

## 4. Visual Rotation Allowlist
Ensure the prompt templates rotation stays within the ~50 high-end templates. Keep untested or low-quality styles (like `GLASSMORPHISM_UI`, `BILLBOARD_HIGHWAY`, or `GRUNGE_STREET_POSTER`) out of the normal rotation pool.

---

## 5. Zero-Limits Assumption
Our prompt generation agents and visual designers must strictly operate under the **Zero-Limits Assumption**. Never assume that AI image generation models (such as Seedance or DALL-E 3) have limitations that prevent them from rendering complex details or specific assets:
- **No Simplification**: Do not simplify, prune, or dumb down visual descriptions or text overlays out of fear that the model cannot render them.
- **Complex Capabilities**: The models can absolutely render rich graphic details, detailed tables, intricate charts, candlestick patterns, custom UI cards, annotations, and heavy text overlays.
- **Write Supreme Quality Prompts**: Always write highly descriptive, rich, structured, and sophisticated prompts to leverage the maximum capabilities of the image generation models. If the prompt quality is supreme, the output will render perfectly.
