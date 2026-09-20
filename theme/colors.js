/**
 * SUVA ERP Mobile Theme Palette
 * Sourced directly from starterkit's _variables.scss (vyzor-nextjs-ts-approuter/starterkit):
 * - Primary Brand Purple (#985FFD): SUVA's signature modern royal purple
 * - Gold Bright (#F7B500): SUVA brand mark gold accent
 * - Secondary (#FF49CD): Vibrant magenta accent
 * - Success Mint (#32D484): Fresh emerald for totals, growth, and positive status
 * - Warning Amber (#FDAF22): Clear warning/due accent
 * - Info Cyan (#00C9FF): Modern electric cyan
 * - Danger Coral (#FF6757): Clean financial debit/danger accent
 * - Accents: Orange (#FA8128), Pink (#FF69B4), Teal (#35B5AA), Purple (#BE2BEB)
 * - Canvas Background (#F8F9FD) & Elevated Pure White Cards (#FFFFFF)
 * - Text Navy (#011A42) & Text Muted (#5D6576)
 */
const rgb = {
  primary: "152, 95, 253",
  gold: "247, 181, 0",
  secondary: "255, 73, 205",
  success: "50, 212, 132",
  warning: "253, 175, 34",
  info: "0, 201, 255",
  danger: "255, 103, 87",
  orange: "250, 129, 40",
  pink: "255, 105, 180",
  teal: "53, 181, 170",
  purple: "190, 43, 235",
  green: "0, 201, 167",
  light: "250, 249, 247",
  dark: "10, 10, 10",
};

export const colors = {
  primary: "#985FFD",
  primaryDark: "#7A3EE6",
  primaryLight: "#F3EEFF",
  gold: "#F7B500",
  goldLight: "#FEF8E7",
  secondary: "#FF49CD",
  secondaryLight: "#FFF0FA",
  success: "#32D484",
  successLight: "#EBFBF3",
  warning: "#FDAF22",
  warningLight: "#FEF7EB",
  info: "#00C9FF",
  infoLight: "#E6FAFF",
  danger: "#FF6757",
  dangerLight: "#FFF1F0",
  orange: "#FA8128",
  orangeLight: "#FFF3EC",
  pink: "#FF69B4",
  pinkLight: "#FFF0F8",
  teal: "#35B5AA",
  tealLight: "#ECF8F7",
  purple: "#BE2BEB",
  purpleLight: "#FAECFD",
  green: "#00C9A7",
  light: "#FAF9F7",
  dark: "#0A0A0A",
  bodyBg: "#F8F9FD",
  cardBg: "#FFFFFF",
  text: "#011A42",
  textMuted: "#5D6576",
  textSubtle: "#8B95A5",
  border: "#E2E8EE",
  borderLight: "#F1F4F8",
  menuPrime: "#302D36",
  iconMuted: "#6C7E96",
  brandBlue: "#985FFD",
  /** Dim behind every modal/drawer — one value so all overlays match. */
  scrim: "rgba(0, 0, 0, 0.88)",
  /** Transparent end of the scrim fade — animate scrimClear -> scrim. */
  scrimClear: "rgba(0, 0, 0, 0)",
  rgb,
};

/**
 * `bg-{color}-transparent` equivalent — the accent at low alpha, for
 * icon chips, badges and tile backgrounds.
 */
export function tint(tone, alpha = 0.12) {
  return `rgba(${rgb[tone] ?? rgb.primary}, ${alpha})`;
}

/** Solid accent for a tone, paired with tint() above. */
export function accent(tone) {
  return colors[tone] ?? colors.primary;
}
