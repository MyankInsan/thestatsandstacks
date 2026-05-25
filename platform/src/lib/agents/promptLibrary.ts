export type ViralStyle =
  // Data Vis
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

  // Human Elements
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
  | 'PREMIUM_CTA';

export const PROMPT_LIBRARY: Record<ViralStyle, string> = {
  // Data Vis
  LINE_CHART: 'A mathematically precise, clean 2D line chart on a dark charcoal matte background. A sharp, jagged line goes exponentially up in a vibrant neon [accent1] color, ending with a small glowing node. A flat, steady line runs along the bottom in neon [accent2]. Faint grid lines overlay the chart. Shot on a professional camera, high contrast, clean editorial design. --ar 4:5 --style raw --v 6.0 --s 200',
  DONUT_CHART: 'A mathematically perfect 3D donut chart hovering in a deep dark space. The chart is split into 5 distinct slices in a sleek matte texture, colored in shades of neon [accent1], [accent2], and clean white. In the empty center hole of the donut chart is a high-fidelity glowing icon or portrait cutout. Clear lines point from each slice to precise stock ticker labels. Clean, ultra-minimalist Bloomberg-terminal style aesthetic. --ar 4:5 --style raw --v 6.0 --s 200',
  BAR_CHART_HORIZONTAL: 'A massive, high-contrast horizontal bar chart on a deep navy background. The bars are thick, sleek, and glowing in neon [accent1] and [accent2]. To the left of each bar is a perfectly rendered corporate logo badge. Very clean, professional financial times report aesthetic. --ar 4:5 --style raw --v 6.0 --s 200',
  SANKEY_DIAGRAM: 'A highly detailed, mathematically precise 3D Sankey diagram flowing left-to-right on a pitch-black matte canvas. Translucent glowing ribbons represent revenue streams splitting organically into costs, R&D, and net profit. The flows glow with vibrant neon [accent1] and [accent2] colors. Text labels and percentages are perfectly aligned, crisp, and clean. Dark grid lines overlay the background. --ar 4:5 --style raw --v 6.0 --s 200',
  RADAR_CHART: 'A futuristic glowing radar chart (spider web chart) on a pitch black background. The web is drawn in neon [accent1] and [accent2] lines, comparing 5 distinct corporate metrics. High-tech, clean corporate aesthetic. --ar 4:5 --style raw --v 6.0 --s 200',
  AREA_CHART: 'A smooth, beautiful 3D area chart where the filled area below the curve resembles a glowing liquid or topographical map in dark emerald and gold. Background is deep charcoal. Modern, financial analytics aesthetic. --ar 4:5 --style raw --v 6.0 --s 200',
  CANDLESTICK_CHART: 'A hyper-realistic close-up of a massive glowing red and green candlestick chart. The background is a blurred trading floor with active stock tickers. Sparks fly off the latest massive green candle. High contrast, dramatic lighting. --ar 4:5 --style raw --v 6.0 --s 200',
  COMPARISON_TABLE: 'A highly detailed, professional financial comparison table on a dark charcoal-textured background. The table has columns for Rank, Company (showing recognizable corporate logos like Nvidia, Palantir, Dell), Amount, and Date/Returns, formatted in clean white and neon [accent1] text. To the right of the table is a sharp, photorealistic cutout portrait of a famous leader or investor (e.g. Donald Trump or a Wall Street executive) looking directly at the camera with dramatic side lighting. Pure black borders, sleek grid. --ar 4:5 --style raw --v 6.0 --s 200',
  HEATMAP_GRID: 'A detailed, high-contrast stock market heatmap grid resembling a tree map. The grid is composed of rectangular boxes in vibrant green representing positive returns and dark red representing negative returns, each box containing bold white ticker symbols (e.g., NVDA, MSFT, GOOGL) and percentage changes. Overlaid in the center is a circular cutout frame containing a colorful meme character (like a green Wojak) or a stylized portrait. --ar 4:5 --style raw --v 6.0 --s 200',
  CIRCULAR_PORTFOLIO_WHEEL: 'A premium, high-tech financial wheel diagram. In the center is a highly detailed, photorealistic studio portrait cutout of a prominent public figure (like Donald Trump or a famous investor) in a dark suit with a red tie. Around this central portrait is a segmented circular ring representing a portfolio, with wedges showing corporate logos (e.g., Apple, Nvidia, Tesla) and percentage labels. Behind the wheel, a dark navy background is illuminated by a subtle, glowing green stock chart pattern. Premium, sharp, high-end editorial feel. --ar 4:5 --style raw --v 6.0 --s 200',

  // Cinematic & Metaphor
  ANIMAL_METAPHOR: 'A cinematic, dramatic 3D render of an intense showdown. A massive, muscular metallic golden bull with glowing eyes faces off against a fierce, roaring grizzly bear made of dark, charcoal-textured stone with glowing red veins. The background is a dark, smoky space with a faint, glowing red stock chart line plunging downwards. Dramatic rim lighting, sparks flying, high tension, shot on a cinema camera. --ar 4:5 --style raw --v 6.0 --s 200',
  NATURE_METAPHOR: 'A cinematic shot of a tiny green sapling growing out of a massive pile of gold coins in a dark, moody forest with volumetric god rays piercing through the canopy. Rich earth textures, deep shadows, representing compounding growth. --ar 4:5 --style raw --v 6.0 --s 200',
  LUXURY_LIFESTYLE: 'A hyper-realistic, cinematic editorial photograph taken inside a Gulfstream private jet cabin. Exquisite cream leather seats, a pristine Rolex Daytona watch resting on a dark walnut table reflecting warm golden hour sunlight streaming through the window. Volumetric light rays, shallow depth of field, shot on Hasselblad H6D-100c, f/2.8, premium color grading with deep rich shadows. --ar 4:5 --style raw --v 6.0 --s 200',
  TECH_HUD: 'A high-tech, cinematic diagram on a dark abstract background with glowing HUD rings and futuristic elements. In the center, a massive, glowing corporate logo. Surrounding the center in a perfect circle are 6 smaller glowing orbs containing logos. Superimposed over this high-tech web. --ar 4:5 --style raw --v 6.0 --s 200',
  CHESS_BOARD_STRATEGY: 'A cinematic close-up of a marble chessboard. A lone pawn is knocking over a massive, ornate king piece. Dust particles in the air, dramatic rim lighting, dark background. --ar 4:5 --style raw --v 6.0 --s 200',
  VAULT_SECURITY: 'A massive, impenetrable steel bank vault door bathed in harsh blue security lights. The door is slightly ajar, revealing glowing gold bars inside. High-end lighting, realistic textures. --ar 4:5 --style raw --v 6.0 --s 200',
  SPORTS_RACING: 'A cinematic motion-blur shot of a sleek F1 racing car speeding past the camera on a dark track at night. Glowing neon sparks fly off the tires. High speed action. --ar 4:5 --style raw --v 6.0 --s 200',
  SPACE_EXPLORATION: 'A hyper-realistic shot of a rocket launching into the dark night sky, massive flames and smoke illuminating the launchpad. High contrast, dramatic, detailed. --ar 4:5 --style raw --v 6.0 --s 200',
  GAMING_LEVEL_UP: 'A nostalgic but premium 16-bit or glowing arcade style "LEVEL UP" notification hovering over a dark synthwave grid. Bright purple and cyan glow. --ar 4:5 --style raw --v 6.0 --s 200',

  // Human Elements
  POP_CULTURE_PORTRAIT: 'A cinematic, highly stylized portrait of a famous movie star or pop culture figure (e.g., Leonardo DiCaprio in a pinstripe suit) standing confidently. The background is a blurred cityscape or trading floor. Floating around the figure are 4 crisp white glowing circles containing corporate logos. --ar 4:5 --style raw --v 6.0 --s 200',
  CARICATURE_PORTRAIT: 'A high-end 3D caricature portrait of a famous tech CEO (e.g., Elon Musk or Jensen Huang) with a slightly exaggerated head, wearing a leather jacket, holding a glowing microchip. Dark background. Studio lighting. --ar 4:5 --style raw --v 6.0 --s 200',
  EXPERT_CUTOUT: 'A professional, sharp photograph cutout of a famous investor (e.g., Cathie Wood) smiling confidently. Background is pure pitch black. Next to them is a floating list of massive text. --ar 4:5 --style raw --v 6.0 --s 200',
  TRADER_DESK_SILHOUETTE: 'A moody, cinematic silhouette of a trader sitting at a multi-monitor desk in a dark room. The only light comes from the glowing screens reflecting off their glasses. --ar 4:5 --style raw --v 6.0 --s 200',
  CROWD_PANIC: 'A blurred, chaotic scene of a massive crowd on a trading floor, hands in the air, papers flying. Desaturated colors with harsh red emergency lighting. --ar 4:5 --style raw --v 6.0 --s 200',
  EXECUTIVE_LINEUP: 'A crisp, professional press-release photograph of three corporate executives standing side-by-side in formal wear. The middle executive is looking confidently at the camera. The background is a clean studio wall. Recognized corporate logo badges are neatly aligned above their heads. Sharp, commercial lighting, high contrast. --ar 4:5 --style raw --v 6.0 --s 200',
  LEADER_LOGO_CUTOUTS: 'A sharp, high-contrast cutout portrait of a prominent political leader (e.g. Donald Trump) in a suit standing centered and looking confidently forward. Floating symmetrically on their left and right sides are two crisp circular logo badges: one containing a high-tech stealth jet and the other a corporate emblem. Volumetric side-lighting, soft blurred natural background. --ar 4:5 --style raw --v 6.0 --s 200',
  CORPORATE_OFFICE_SPACE: 'A premium, clean editorial photograph of a modern tech corporate office interior. Concrete walls, glass partitions, desks with monitors, employees working in smart-casual attire. A concrete wall displays a clean, white corporate logo mark. Moody studio side-lighting. --ar 4:5 --style raw --v 6.0 --s 200',
  MILITARY_AEROSPACE_METAPHOR: 'A cinematic, dramatic high-fidelity 3D render of a sleek hypersonic military cruise missile flying at extreme speeds through the upper atmosphere. A glowing orange jet flame and pink trail stream behind it. A dramatic sunset sky is in the background with soft clouds below. High-end rendering, detailed metallic textures. --ar 4:5 --style raw --v 6.0 --s 200',

  // Typography & Layouts
  ARCHITECTURAL_OVERLAY: 'A cinematic, hyper-realistic, slightly desaturated photograph of a corporate headquarters or Wall Street building. High contrast, premium editorial photo. --ar 4:5 --style raw --v 6.0 --s 200',
  MINIMALIST_CHECKLIST: 'A perfectly clean, Swiss-design minimalist checklist on a dark matte navy background. White text with neon green checkmarks. The layout is perfectly aligned and spaced. --ar 4:5 --style raw --v 6.0 --s 200',
  GLOWING_QUOTE: 'A massive set of glowing neon quotation marks framing an elegant, bold serif font on a pitch black textured wall. Cinematic spotlighting hits the text. --ar 4:5 --style raw --v 6.0 --s 200',
  NEON_TERMINAL: 'A retro-futuristic dark computer terminal screen. Glowing green monospaced text cursor blinking. Matrix hacker aesthetic. --ar 4:5 --style raw --v 6.0 --s 200',
  MAGAZINE_COVER: 'A layout resembling a high-end financial magazine cover (like Forbes or TIME). A striking central subject with massive, elegant serif typography wrapping around it. --ar 4:5 --style raw --v 6.0 --s 200',
  BILLBOARD_HIGHWAY: 'A photorealistic shot of a massive neon billboard over a dark, rainy highway at night. High contrast. --ar 4:5 --style raw --v 6.0 --s 200',
  FLUID_LIQUID_TEXT: 'Abstract 3D typography made of dark, swirling metallic liquid and glowing lava. The liquid forms the words. --ar 4:5 --style raw --v 6.0 --s 200',
  GLASSMORPHISM_UI: 'A clean, modern Apple-style UI layout. A frosted glass panel hovering over a blurred colorful background. The glass panel contains crisp dark text. --ar 4:5 --style raw --v 6.0 --s 200',
  GRUNGE_STREET_POSTER: 'A heavily textured, distressed paper poster glued to a dark, gritty brick wall in a rainy alley. Spray painted stenciled letters. --ar 4:5 --style raw --v 6.0 --s 200',
  PREMIUM_CTA: 'A stunning, ultra-premium cinematic shot of a modern, luxury executive boardroom with a large dark marble table. In the center of the table rests a glowing, sleek 3D holographic globe and active financial chart lines representing compounding wealth. The background shows floor-to-ceiling glass windows overlooking a glowing nighttime city skyline. Warm golden hour lighting, rich textures, professional editorial photography. --ar 4:5 --style raw --v 6.0 --s 200',
};
