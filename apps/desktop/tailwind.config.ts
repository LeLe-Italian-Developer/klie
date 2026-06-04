import type { Config } from "tailwindcss";
import shared from "../../packages/ui/tailwind.config";

const config: Config = {
  presets: [shared],
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;
