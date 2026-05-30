export type ViralStyle =
  // Data viz
  | 'LINE_CHART'
  | 'DONUT_CHART'
  | 'BAR_CHART_HORIZONTAL'
  | 'SANKEY_DIAGRAM'
  | 'RADAR_CHART'
  | 'AREA_CHART'
  | 'CANDLESTICK_CHART'
  | 'COMPARISON_TABLE'
  | 'HEATMAP_GRID'
  | 'CIRCULAR_PORTFOLIO_WHEEL'

  // Cinematic & Metaphor
  | 'ANIMAL_METAPHOR'
  | 'NATURE_METAPHOR'
  | 'LUXURY_LIFESTYLE'
  | 'TECH_HUD'
  | 'CHESS_BOARD_STRATEGY'
  | 'VAULT_SECURITY'
  | 'SPORTS_RACING'
  | 'SPACE_EXPLORATION'
  | 'GAMING_LEVEL_UP'

  // Human elements
  | 'POP_CULTURE_PORTRAIT'
  | 'CARICATURE_PORTRAIT'
  | 'EXPERT_CUTOUT'
  | 'TRADER_DESK_SILHOUETTE'
  | 'CROWD_PANIC'
  | 'EXECUTIVE_LINEUP'
  | 'LEADER_LOGO_CUTOUTS'
  | 'CORPORATE_OFFICE_SPACE'
  | 'MILITARY_AEROSPACE_METAPHOR'

  // Typography & Layouts
  | 'ARCHITECTURAL_OVERLAY'
  | 'MINIMALIST_CHECKLIST'
  | 'GLOWING_QUOTE'
  | 'NEON_TERMINAL'
  | 'MAGAZINE_COVER'
  | 'BILLBOARD_HIGHWAY'
  | 'FLUID_LIQUID_TEXT'
  | 'GLASSMORPHISM_UI'
  | 'GRUNGE_STREET_POSTER'
  | 'PREMIUM_CTA'

  // v2 specialized financial visualization templates
  | 'CANDLESTICK_HERO'
  | 'CANDLESTICK_PATTERN_ANNOTATED'
  | 'TRADING_DESK_OVERLAY'
  | 'INSTITUTIONAL_FLOW_SANKEY'
  | 'PORTFOLIO_DOUGHNUT_PORTRAIT'
  | 'CAP_TABLE_GRID'
  | 'TICKER_TAPE_HERO'
  | 'EARNINGS_HEAT_TABLE'
  | 'POSITION_CONCENTRATION_TREEMAP'
  | 'MACRO_FLOW_DIAGRAM'
  | 'PRICE_TIMELINE_ANNOTATED'
  | 'PORTFOLIO_BAR_RACE'
  | 'EDITORIAL_SPLIT_LAYOUT'
  | 'EARNINGS_CARD'
  | 'MAP_DATA_OVERLAY'
  | 'EDITORIAL_REACTION_CARICATURE'
  | 'TYPOGRAPHIC_MEGA_NUMBER'
  // Meme / Satirical structures
  | 'MEME_COMIC_PLATE'
  | 'SATIRICAL_METAPHOR'
  | 'FUNNY_COMPARISON';

export const PROMPT_LIBRARY: Record<ViralStyle, string> = {
  // ── Data viz ─────────────────────────────────────────────────────────────
  LINE_CHART: 'A mathematically precise, clean 2D line chart on a dark charcoal matte background. A sharp, jagged line goes exponentially up in a vibrant neon [accent1] color, ending with a small glowing node. A flat, steady line runs along the bottom in neon [accent2]. Faint grid lines overlay the chart. Shot on a professional camera, high contrast, clean editorial design.',
  DONUT_CHART: 'A mathematically perfect 3D donut chart hovering in a deep dark space. The chart is split into 5 distinct slices in a sleek matte texture, colored in shades of neon [accent1], [accent2], and clean white. In the empty center hole of the donut chart is a high-fidelity glowing icon or portrait cutout. Clear lines point from each slice to precise stock ticker labels. Clean, ultra-minimalist Bloomberg-terminal style aesthetic.',
  BAR_CHART_HORIZONTAL: 'A massive, high-contrast horizontal bar chart on a deep navy background. The bars are thick, sleek, and glowing in neon [accent1] and [accent2]. To the left of each bar is a perfectly rendered corporate logo badge. Very clean, professional financial times report aesthetic.',
  SANKEY_DIAGRAM: 'A highly detailed, mathematically precise 3D Sankey diagram flowing left-to-right on a pitch-black matte canvas. Translucent glowing ribbons represent revenue streams splitting organically into costs, R&D, and net profit. The flows glow with vibrant neon [accent1] and [accent2] colors. Text labels and percentages are perfectly aligned, crisp, and clean. Dark grid lines overlay the background.',
  RADAR_CHART: 'A futuristic glowing radar chart (spider web chart) on a pitch black background. The web is drawn in neon [accent1] and [accent2] lines, comparing 5 distinct corporate metrics. High-tech, clean corporate aesthetic.',
  AREA_CHART: 'A smooth, beautiful 3D area chart where the filled area below the curve resembles a glowing liquid or topographical map in dark emerald and gold. Background is deep charcoal. Modern, financial analytics aesthetic.',
  CANDLESTICK_CHART: 'A hyper-realistic close-up of a massive glowing red and green candlestick chart. The background is a blurred trading floor with active stock tickers. Sparks fly off the latest massive green candle. High contrast, dramatic lighting.',
  COMPARISON_TABLE: 'A highly detailed, professional financial comparison table on a dark charcoal-textured background. The table has columns for Rank, Company (showing recognizable corporate logos), Amount, and Date/Returns, formatted in clean white and neon [accent1] text. To the right of the table is a sharp, photorealistic cutout portrait of [portraitDescription] looking directly at the camera with dramatic side lighting. Pure black borders, sleek grid.',
  HEATMAP_GRID: 'A detailed, high-contrast stock market heatmap grid resembling a tree map. The grid is composed of rectangular boxes in vibrant green representing positive returns and dark red representing negative returns, each box containing bold white ticker symbols and percentage changes. Overlaid in the center is a circular cutout frame containing [portraitDescription].',
  CIRCULAR_PORTFOLIO_WHEEL: 'A premium, high-tech financial wheel diagram. In the center is a highly detailed, photorealistic studio portrait cutout of [portraitDescription] in formal attire. Around this central portrait is a segmented circular ring representing a portfolio, with wedges showing corporate logos and percentage labels. Behind the wheel, a dark navy background is illuminated by a subtle, glowing green stock chart pattern. Premium, sharp, high-end editorial feel.',

  // ── Cinematic & Metaphor ─────────────────────────────────────────────────
  ANIMAL_METAPHOR: 'A cinematic, dramatic 3D render of [animalMetaphor]. The background is a dark, smoky space with a faint, glowing stock chart line in the distance. Shot with ARRI Alexa 65 anamorphic, cinematic color grading, 35mm lens, dramatic rim lighting, premium textures, and high contrast.',
  NATURE_METAPHOR: 'A cinematic shot of a tiny green sapling growing out of a massive pile of gold coins in a dark, moody forest with volumetric god rays piercing through the canopy. Rich earth textures, deep shadows, representing compounding growth. Shot on ARRI Alexa 65, cinematic color grading.',
  LUXURY_LIFESTYLE: 'A hyper-realistic, cinematic editorial photograph taken inside a Gulfstream private jet cabin. Exquisite cream leather seats, a pristine Rolex Daytona watch resting on a dark walnut table reflecting warm golden hour sunlight streaming through the window. Volumetric light rays, shallow depth of field, shot on Hasselblad H6D-100c, f/2.8, premium color grading with deep rich shadows. Pure editorial photography, no AI artifacts.',
  TECH_HUD: 'A high-tech, cinematic diagram on a dark abstract background with glowing HUD rings and futuristic elements. In the center, a massive, glowing corporate logo. Surrounding the center in a perfect circle are 6 smaller glowing orbs containing logos. Superimposed over this high-tech web.',
  CHESS_BOARD_STRATEGY: 'A cinematic close-up of a marble chessboard. A lone pawn is knocking over a massive, ornate king piece. Dust particles in the air, dramatic rim lighting, dark background. Shot on ARRI Alexa 65, anamorphic.',
  VAULT_SECURITY: 'A massive, impenetrable steel bank vault door bathed in harsh blue security lights. The door is slightly ajar, revealing glowing gold bars inside. High-end lighting, realistic textures. Phase One IQ4, tilt-shift lens.',
  SPORTS_RACING: 'A cinematic motion-blur shot of a sleek F1 racing car speeding past the camera on a dark track at night. Glowing neon sparks fly off the tires. High speed action. ARRI Alexa 65 anamorphic.',
  SPACE_EXPLORATION: 'A hyper-realistic shot of a rocket launching into the dark night sky, massive flames and smoke illuminating the launchpad. High contrast, dramatic, detailed. ARRI Alexa 65.',
  GAMING_LEVEL_UP: 'A glowing arcade-style "LEVEL UP" notification hovering over a dark synthwave grid in [accent1] and [accent2] brand colors. Volumetric glow, cinematic rim lighting, premium retro-futurist aesthetic — not cartoon, not generic.',

  // ── Human elements ───────────────────────────────────────────────────────
  POP_CULTURE_PORTRAIT: 'A cinematic, highly stylized portrait of [portraitDescription] standing confidently in a tailored dark suit. The background is a blurred cityscape or trading floor. Floating around the figure are 4 crisp white glowing circles containing corporate logos. Editorial-magazine treatment, shot on Hasselblad H6D-100c, f/4, Rembrandt lighting.',
  CARICATURE_PORTRAIT: 'A high-end 3D caricature portrait of [portraitDescription] with a slightly exaggerated head, holding a relevant prop (glowing microchip, gavel, ledger). Dark background. Studio lighting. New Yorker / Vanity Fair editorial caricature treatment. Shot on Hasselblad H6D-100c, f/4.',
  EXPERT_CUTOUT: 'A professional, sharp photograph cutout of [portraitDescription] smiling confidently. Background is pure pitch black. Next to them is a floating list of massive text. Dramatic side-lit studio rim lighting. Shot on Hasselblad H6D-100c, f/2.8.',
  TRADER_DESK_SILHOUETTE: 'A moody, cinematic silhouette of a trader sitting at a multi-monitor desk in a dark room. The only light comes from the glowing screens reflecting off their glasses. Sony A7R, f/1.8.',
  CROWD_PANIC: 'A blurred, chaotic scene of a massive crowd on a trading floor, hands in the air, papers flying. Desaturated colors with harsh red emergency lighting. ARRI Alexa 65.',
  EXECUTIVE_LINEUP: 'A crisp, professional press-release photograph of three corporate executives standing side-by-side in formal wear. The middle executive is looking confidently at the camera. The background is a clean studio wall. Recognized corporate logo badges are neatly aligned above their heads. Sharp, commercial lighting, high contrast. Hasselblad H6D-100c, f/4.',
  LEADER_LOGO_CUTOUTS: 'A sharp, high-contrast cutout portrait of [portraitDescription] in a suit, standing centered and looking confidently forward. Floating symmetrically on their left and right sides are two crisp circular logo badges. Volumetric side-lighting, soft blurred natural background. Hasselblad H6D-100c, f/4.',
  CORPORATE_OFFICE_SPACE: 'A premium, clean editorial photograph of a modern tech corporate office interior. Concrete walls, glass partitions, desks with monitors, employees working in smart-casual attire. A concrete wall displays a clean, white corporate logo mark. Moody studio side-lighting. Phase One IQ4, tilt-shift lens.',
  MILITARY_AEROSPACE_METAPHOR: 'A cinematic, dramatic high-fidelity 3D render of a sleek hypersonic military cruise missile flying at extreme speeds through the upper atmosphere. A glowing orange jet flame and pink trail stream behind it. A dramatic sunset sky is in the background with soft clouds below. High-end rendering, detailed metallic textures. ARRI Alexa 65.',

  // ── Typography & Layouts ─────────────────────────────────────────────────
  ARCHITECTURAL_OVERLAY: 'A cinematic, hyper-realistic, slightly desaturated photograph of a corporate headquarters or Wall Street building shot from a low angle with dramatic perspective. Golden-hour light grazes the upper facade; the lower facade is in deep shadow. Sharp architectural lines, premium editorial photography, shot on Phase One IQ4 with a tilt-shift lens. No people, no text overlays — pure architectural geometry.',
  MINIMALIST_CHECKLIST: 'A perfectly clean, Swiss-design minimalist checklist on a dark matte navy background. White text with neon [accent1] checkmarks. Generous negative space, perfectly aligned. Editorial Vignelli grid system.',
  GLOWING_QUOTE: 'A massive set of glowing neon [accent1] quotation marks framing an elegant, bold serif font (Bodoni or Didot) on a pitch black textured wall. Cinematic spotlighting hits the text. Editorial pull-quote treatment.',
  NEON_TERMINAL: 'A retro-futuristic Bloomberg-Terminal-style dark screen. Glowing amber and green IBM Plex Mono text with a blinking cursor. Crisp grid lines, dense market data layout, mid-1990s Wall Street CRT aesthetic.',
  MAGAZINE_COVER: 'A layout in the style of a high-end financial magazine cover (Monocle or Bloomberg Businessweek). A striking central subject with massive elegant serif typography wrapping around it. Tight grid, generous whitespace, premium print color grading. Hasselblad H6D-100c, f/4.',
  BILLBOARD_HIGHWAY: 'A photorealistic shot of a massive neon billboard over a dark, rainy highway at night. High contrast, blade-runner aesthetic.',
  FLUID_LIQUID_TEXT: 'Abstract 3D typography made of dark, swirling metallic liquid and glowing lava in [accent1] and [accent2]. The liquid forms the words. Cinematic studio lighting.',
  GLASSMORPHISM_UI: 'A clean, modern Apple-style UI layout. A frosted glass panel hovering over a blurred colorful background. The glass panel contains crisp dark text.',
  GRUNGE_STREET_POSTER: 'A heavily textured, distressed paper poster glued to a dark, gritty brick wall in a rainy alley. Spray painted stenciled letters.',
  PREMIUM_CTA: 'A stunning, ultra-premium cinematic shot of a modern luxury executive boardroom with a large dark marble table. In the center of the table rests a glowing sleek 3D holographic globe and active financial chart lines representing compounding wealth. The background shows floor-to-ceiling glass windows overlooking a glowing nighttime city skyline. Warm golden hour lighting, rich textures, professional editorial photography. Phase One IQ4.',

  // ── v2 Specialized Financial Viz ─────────────────────────────────────────
  CANDLESTICK_HERO: 'A hyper-realistic Bloomberg-terminal-grade close-up of a single OHLC candlestick chart for [stock]. Pitch-black [bg] background, faint 8x8 dot-grid. Eight cleanly drawn candles march left to right; the final candle is a massive bullish wick rendered in vivid [accent1] with a glowing tip. Y-axis on the right shows three legible price tags in crisp white monospaced font. A horizontal dashed [accent2] line marks a key level with a clean label. Top-left a clean ticker block reads "[stock] [price] [pct]%". Volume bars at base in muted [accent2]. Shot like a TradingView screen capture, ultra-sharp, no chart junk, perfect text legibility, no extra digits, no duplicated numerals.',
  CANDLESTICK_PATTERN_ANNOTATED: 'A textbook-grade candlestick pattern study on [bg], rendered in the style of an Investopedia diagram crossed with a Bloomberg chart. Twelve candles form a clear pattern (engulfing, hammer, or breakout depending on context). The pattern candles are highlighted with a soft [accent1] glow halo and an arced [accent1] annotation arrow with a clean serif label. A second callout in [accent2] reads a short signal. Faint dotted support/resistance lines run horizontally. The whole chart is centered on canvas with breathing room; numbers and pattern labels are rendered in legible bold sans-serif, no jitter, no extra digits.',
  TRADING_DESK_OVERLAY: 'A cinematic moody trader desk shot — six curved Eizo monitors glowing into a darkened room, single warm tungsten desk lamp, reflections on a glass mug, hands on a mechanical keyboard out of focus. Composited cleanly on top: a sharp 2D ticker tape strip running along the bottom edge showing 3-4 tickers with green gains in [accent1] and red losses. A floating semi-transparent annotation box top-right in [accent2] outline holds a one-line callout. Editorial photography, Sony A7R, f/1.8, golden-hour-blue mix. Overlay graphics crisp, monospaced, perfectly readable.',
  INSTITUTIONAL_FLOW_SANKEY: 'A precision 3D Sankey diagram on [bg], left-to-right, in the visual language of a Financial Times print infographic. Three thick origin ribbons on the left labeled with institution names (e.g. Berkshire, BlackRock, Vanguard) glow softly in [accent1]. Ribbons fork mid-canvas and recombine into six destination ribbons on the right, each terminating at a crisp corporate logo badge with a numeric weight percentage rendered in [accent2] monospaced font next to it. Ribbon thickness is proportional to value. Faint isometric grid floor. Every label legible, no overlapping flows.',
  PORTFOLIO_DOUGHNUT_PORTRAIT: 'A premium editorial composition. Centered: a photoreal cutout portrait of [portraitDescription] in formal wear, dramatically side-lit, sharp cutout on [bg]. Concentrically wrapped around the portrait: a perfect doughnut chart with 6-8 segments in graduated [accent1] and [accent2] tones. Each segment has a thin leader line pointing outward to a small floating corporate logo and a percentage label in clean sans-serif. The hole of the doughnut frames the portrait\'s face. Subtle volumetric rim light. Wall Street Journal cover energy. Hasselblad H6D-100c, f/4.',
  CAP_TABLE_GRID: 'A clean 4x3 grid of 12 corporate logo tiles on [bg], styled like a YC batch announcement or a Sequoia portfolio page. Each tile is a soft dark card with subtle [accent2] border glow, a single high-fidelity corporate logo centered, and a bottom strip showing ticker and percentage in crisp white monospaced font with the percentage in [accent1]. Tiles are mathematically aligned with identical padding, no logo distortion. Top of canvas reads a small eyebrow plate. Editorial financial-newsroom aesthetic. Phase One IQ4.',
  TICKER_TAPE_HERO: 'A kinetic Times-Square-meets-Bloomberg ticker tape banner stretching across the canvas on [bg]. The lead ticker "[stock]" is dramatically heroed in the center, rendered 4x larger than the surrounding tickers in a bold neon [accent1] LED-display font, with its price and percent change glowing beside it. Flanking tickers scroll in dim [accent2] at quarter size, slightly motion-blurred suggesting horizontal scroll. Reflective black floor underneath catches the LED glow. Cinematic 35mm with subtle chromatic aberration on the LEDs only. Sony A7R, f/1.8.',
  EARNINGS_HEAT_TABLE: 'A Bloomberg-terminal earnings table on [bg]. A clean 6-row by 5-column table with columns labeled TICKER | EPS EST | EPS ACT | SURPRISE | REACTION. Each cell is rendered in monospaced sans-serif, perfectly aligned. The SURPRISE column cells are filled with graduated heat color: deep green ([accent1]) for beats, deep red for misses, with the percentage centered in white bold. REACTION column shows the after-hours move with a tiny inline up or down arrow. Table header row in [accent2] muted band. Faint vertical guides between columns. No chart junk. Every number must be unique and realistic, no repeating digits.',
  POSITION_CONCENTRATION_TREEMAP: 'A premium portfolio treemap on [bg] in the style of finviz.com but elevated to editorial quality. The canvas is tiled with 10-14 rectangles of varying sizes proportional to position weight. Each rectangle holds a centered corporate logo and a stacked label: ticker (large white) above percentage (smaller, in [accent1] for winners or red for losers). Rectangles have subtle dark gradient fills (deep green tints for winners, deep red for losers), thin matte black gutters between. Top of canvas: a small eyebrow with portfolio name and total value. Sharp, no logo distortion, no overlap.',
  MACRO_FLOW_DIAGRAM: 'A clean horizontal cause-and-effect flow diagram on [bg], in the style of a Stratechery essay illustration. Four equally spaced nodes from left to right (e.g. "FED CUTS RATES" then "LOWER BORROWING COST" then "MARGIN EXPANSION" then "[stock] +[pct]%"). Each node is a soft rounded rectangle with [accent2] outline glow and a small iconographic glyph above (gavel, dollar, factory, rocket). Arrows between nodes are [accent1] with subtle directional pulse. All node text in bold sans-serif, perfectly centered, perfectly legible.',
  PRICE_TIMELINE_ANNOTATED: 'A premium multi-year price chart of [stock] on [bg]. A single smooth white-to-[accent1] gradient price line rises with realistic volatility. Four milestone callouts attached via thin diagonal leader lines, each a small floating chip with a date and a 3-word event (e.g. "Mar 2023: AI BOOM", "Aug 2024: SPLIT 10:1"). Subtle dotted x-axis with year labels. Bloomberg/FT print quality, no chart junk, every label crisp.',
  PORTFOLIO_BAR_RACE: 'A premium horizontal bar chart on [bg], styled as a frame from a financial-newsroom bar race animation. Eight horizontal bars stacked vertically, each anchored at the left with: a perfect circular corporate logo badge then ticker symbol in bold sans-serif then a thick glowing bar filling rightward in [accent1] with a slight [accent2] tip then a numeric label in monospaced font at the bar\'s terminus. Bars descend in length, perfectly sorted. Tiny eyebrow above shows ranking label and date. Single source of motion-implication: subtle horizontal speed-streaks behind the longest bar only.',
  EDITORIAL_SPLIT_LAYOUT: 'A premium magazine-style split-canvas layout on [bg]. The left 45% of canvas holds a single moody photographic portrait (the subject relevant to the topic) shot in cinematic golden hour light. The right 55% holds elegant editorial typography: a bold uppercase eyebrow in [accent2], a massive serif headline in pure white, and a small body line in light grey sans-serif. Thin [accent1] vertical rule separates the two halves. Generous breathing room. Monocle / Bloomberg Businessweek print quality. Hasselblad H6D-100c, f/2.8.',
  EARNINGS_CARD: 'A premium Apple-product-page-style metric tile centered on [bg]. A single large tile with a subtle gradient ([accent1] glow at one corner, [accent2] glow at the opposite). Inside the tile, perfectly centered: ticker symbol in monospaced font at top, massive hero number in custom-cut display serif center, a small label below in light grey. Subtle drop shadow under the tile. Apple-event keynote aesthetic, ultra-clean, no chart junk.',
  MAP_DATA_OVERLAY: 'A clean editorial choropleth map of Canada (or a relevant region) on [bg]. Provincial outlines in white at low opacity; each province filled with a heat-color graduation from light to dark [accent1] proportional to a data value. Small white labels with the data value sit on each province. Top of canvas reads an eyebrow describing the metric. Cartographic gridlines extremely subtle. No coastlines, no extra geography, just clean province shapes.',
  EDITORIAL_REACTION_CARICATURE: 'A high-quality editorial caricature of [portraitDescription] in the New Yorker / Vanity Fair illustrated portrait tradition. Ink-and-watercolor treatment on a clean matte [bg] background with a subtle [accent1] vignette. Slightly exaggerated but elegant and dignified features. The subject is reacting to a financial event with a specific, identifiable expression (concerned, amused, contemplative). Single light source, rich ink details, professional editorial print illustration only, breathing room around the figure.',
  TYPOGRAPHIC_MEGA_NUMBER: 'A single massive numeric figure rendered as the entire composition — e.g. "+18.2%" or "$2.4B" filling 70% of the canvas in custom-cut ultra-condensed display serif, color [accent1], set against a flat [bg] background with a faint paper-grain texture. The numerals have sharp ink-trap detailing and slight optical kerning. A small editorial caption sits in the lower-third in 14pt sans-serif. Render the exact number, perfectly spelled, no extra digits, no duplicated numerals. Massimo Vignelli editorial typography reference.',
  MEME_COMIC_PLATE: 'A high-end, 2-frame comic strip layout on [bg] with a hand-drawn ink and watercolor style. The left frame shows [portraitDescription] looking smugly at a chart that goes up, with a speech balloon showing [leftText]. The right frame shows them sweating profusely as the chart crashes, with a speech balloon showing [rightText]. Premium New Yorker editorial cartoon style.',
  SATIRICAL_METAPHOR: 'A high-fidelity satirical concept illustration in the style of a modern editorial publication. [satiricalConcept] on [bg]. Shot with Phase One IQ4, crisp focus, clean layout, generous negative space, moody rim lighting, high-contrast, professional editorial print-cartoon style.',
  FUNNY_COMPARISON: 'A high-contrast comparison scene on [bg]. On the left side, [comparisonLeft]. On the right side, [comparisonRight]. Shot with Phase One IQ4, dramatic side-lighting, clean split composition, generous breathing room, premium editorial feel.',
};

/**
 * Styles excluded from SlideNarrativeAgent's normal rotation pool. They remain
 * in the library so explicit overrides still work, but the LLM is told not to
 * pick them. Rationale: never produced premium output, conflicts with global
 * anti-AI-tells, or contains hardcoded subject that didn't parametrize cleanly.
 */
export const EXCLUDED_FROM_ROTATION: ViralStyle[] = [
  'FLUID_LIQUID_TEXT',
  'BILLBOARD_HIGHWAY',
  'GRUNGE_STREET_POSTER',
  'GLASSMORPHISM_UI',
];

export const ROTATION_ALLOWLIST: ViralStyle[] = (Object.keys(PROMPT_LIBRARY) as ViralStyle[])
  .filter((s) => !EXCLUDED_FROM_ROTATION.includes(s));
