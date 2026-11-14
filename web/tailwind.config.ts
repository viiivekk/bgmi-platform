import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { bg: "#0B0E14", panel: "#141923", card: "#191F2B", line: "#262E3F", mute: "#8B94A7", blue: "#3987FF", violet: "#885BFF" },
    fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
  } },
  plugins: [],
} satisfies Config;
