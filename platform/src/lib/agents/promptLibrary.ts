export type ViralStyle =
  // Data Vis
  | 'LINE_CHART'
  | 'DONUT_CHART'
  | 'BAR_CHART_HORIZONTAL'
  | 'SANKEY_DIAGRAM'
  | 'RADAR_CHART'
  | 'AREA_CHART'
  | 'CANDLESTICK_CHART'
  
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

  // Typography & Layouts
  | 'ARCHITECTURAL_OVERLAY'
  | 'MINIMALIST_CHECKLIST'
  | 'GLOWING_QUOTE'
  | 'NEON_TERMINAL'
  | 'MAGAZINE_COVER'
  | 'BILLBOARD_HIGHWAY'
  | 'FLUID_LIQUID_TEXT'
  | 'GLASSMORPHISM_UI'
  | 'GRUNGE_STREET_POSTER';

export const PROMPT_LIBRARY: Record<ViralStyle, string> = {
  // Data Vis
  LINE_CHART: 'A simple, photorealistic, high-contrast 2D line chart on a pitch-black background. A sharp, jagged line goes exponentially up in a bright neon [accent1] color, with a dot at the end. A flat, steady line goes slightly up in a bright neon [accent2] color. Overlaying the chart: [text]. The entire image must be clean, data-focused, and highly legible. --ar 4:5 --style raw --v 6.0 --s 200',
  DONUT_CHART: 'A flawless, modern, dark-mode donut chart / pie chart. The background is pitch black. The chart has exactly 8 distinct colored slices in a sleek matte finish. In the empty center hole is a high-quality cutout. Floating next to the slices are crisp stock tickers and percentages. At the top, bold white and green text reads: [text]. Clean corporate aesthetic. --ar 4:5 --style raw --v 6.0 --s 200',
  BAR_CHART_HORIZONTAL: 'A massive, high-contrast horizontal bar chart on a dark background. The bars are thick and glowing neon [accent1]. To the left of each bar is a perfectly rendered corporate logo or avatar. Overlaid text: [text]. Very clean, financial times aesthetic. --ar 4:5 --style raw --v 6.0 --s 200',
  SANKEY_DIAGRAM: 'A highly detailed, cinematic Sankey diagram flowing from left to right on a dark canvas. The flows split and merge organically, colored in shades of glowing green and red. Labels indicate revenue and expenses perfectly. In the corner is a stylized portrait. Massive text overlaid at the top: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  RADAR_CHART: 'A futuristic glowing radar chart (spider web chart) on a pitch black background. The web is drawn in neon cyan and magenta. It compares 5 distinct metrics. Overlaid text: [text]. High tech aesthetic. --ar 4:5 --style raw --v 6.0 --s 200',
  AREA_CHART: 'A beautiful, smooth 3D area chart where the filled area below the curve resembles a glowing liquid or topographical map in dark emerald and gold. Background is deep charcoal. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  CANDLESTICK_CHART: 'A hyper-realistic close-up of a massive glowing red and green candlestick chart. The background is a blurred trading floor. Sparks fly off the latest massive green candle. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',

  // Cinematic & Metaphor
  ANIMAL_METAPHOR: 'A hyper-realistic, cinematic 3D render. A massive, aggressive metallic golden bull faces off against a fierce, roaring dark red bear. The background is a glowing red stock chart showing a sharp decline. Overlay text: [text]. Intense, epic lighting, dramatic. --ar 4:5 --style raw --v 6.0 --s 200',
  NATURE_METAPHOR: 'A cinematic shot of a tiny sapling growing out of a massive pile of gold coins in a dark, moody forest with god rays piercing through the canopy. Overlay text: [text]. Symbolizing compounding growth. --ar 4:5 --style raw --v 6.0 --s 200',
  LUXURY_LIFESTYLE: 'A hyper-realistic photo taken inside a private jet with cream leather seats, a Rolex on the table, and clouds out the window. Warm golden hour lighting. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  TECH_HUD: 'A high-tech, cinematic diagram on a dark abstract background with glowing HUD rings and futuristic elements. In the center, a massive, glowing corporate logo. Surrounding the center in a perfect circle are 6 smaller glowing orbs containing logos. Superimposed over this high-tech web is the text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  CHESS_BOARD_STRATEGY: 'A cinematic close-up of a marble chessboard. A lone pawn is knocking over a massive, ornate king piece. Dust particles in the air, dramatic rim lighting. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  VAULT_SECURITY: 'A massive, impenetrable steel bank vault door bathed in harsh blue security lights. The door is slightly ajar, revealing glowing gold bars inside. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  SPORTS_RACING: 'A cinematic motion-blur shot of a sleek F1 racing car speeding past the camera on a dark track at night. Glowing neon sparks. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  SPACE_EXPLORATION: 'A hyper-realistic shot of a rocket launching into the dark night sky, massive flames and smoke illuminating the launchpad. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  GAMING_LEVEL_UP: 'A nostalgic but premium 16-bit or glowing arcade style "LEVEL UP" notification hovering over a dark synthwave grid. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',

  // Human Elements
  POP_CULTURE_PORTRAIT: 'A cinematic, highly stylized portrait of a famous movie star or pop culture figure (e.g., Leonardo DiCaprio in a pinstripe suit) standing confidently. The background is a blurred cityscape or trading floor. Floating around the figure are 4 crisp white glowing circles containing logos. Superimposed text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  CARICATURE_PORTRAIT: 'A high-end 3D caricature portrait of a famous tech CEO (e.g., Elon Musk or Jensen Huang) with a slightly exaggerated head, wearing a leather jacket, holding a glowing microchip. Dark background. Superimposed text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  EXPERT_CUTOUT: 'A professional, sharp photograph cutout of a famous investor (e.g., Cathie Wood) smiling confidently. Background is pure pitch black. Next to them is a floating list of massive text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  TRADER_DESK_SILHOUETTE: 'A moody, cinematic silhouette of a trader sitting at a multi-monitor desk in a dark room. The only light comes from the glowing screens reflecting off their glasses. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  CROWD_PANIC: 'A blurred, chaotic scene of a massive crowd on a trading floor, hands in the air, papers flying. Desaturated colors with harsh red emergency lighting. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',

  // Typography & Layouts
  ARCHITECTURAL_OVERLAY: 'A cinematic, hyper-realistic, slightly desaturated photograph of a corporate headquarters or Wall Street building. Overlaid directly in the center of the image is: [text]. The text must be huge, high-contrast, distressed neon, dominating 40% of the screen. --ar 4:5 --style raw --v 6.0 --s 200',
  MINIMALIST_CHECKLIST: 'A perfectly clean, Swiss-design minimalist checklist on a dark matte navy background. White text with neon green checkmarks. The layout is perfectly aligned and spaced. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  GLOWING_QUOTE: 'A massive set of glowing neon quotation marks framing an elegant, bold serif font on a pitch black textured wall. Cinematic spotlighting hits the text. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  NEON_TERMINAL: 'A retro-futuristic dark computer terminal screen. Glowing green monospaced text cursor blinking. Overlay text: [text]. Matrix hacker aesthetic. --ar 4:5 --style raw --v 6.0 --s 200',
  MAGAZINE_COVER: 'A layout resembling a high-end financial magazine cover (like Forbes or TIME). A striking central subject with massive, elegant serif typography wrapping around it. Overlay text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  BILLBOARD_HIGHWAY: 'A photorealistic shot of a massive neon billboard over a dark, rainy highway at night. The billboard screen vividly displays: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  FLUID_LIQUID_TEXT: 'Abstract 3D typography made of dark, swirling metallic liquid and glowing lava. The liquid forms the words: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  GLASSMORPHISM_UI: 'A clean, modern Apple-style UI layout. A frosted glass panel hovering over a blurred colorful background. The glass panel contains crisp dark text: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
  GRUNGE_STREET_POSTER: 'A heavily textured, distressed paper poster glued to a dark, gritty brick wall in a rainy alley. Spray painted stenciled letters read: [text]. --ar 4:5 --style raw --v 6.0 --s 200',
};
