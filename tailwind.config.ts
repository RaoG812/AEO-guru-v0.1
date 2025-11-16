import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#050709",
        slateglass: "rgba(255,255,255,0.08)",
        silver: {
          50: "#f6f7fb",
          100: "#e8ebf5",
          400: "#b0b7c8",
          500: "#969eb2",
          600: "#7a8194",
          900: "#04050a"
        }
      },
      fontFamily: {
        grotesk: ["Space Grotesk", "sans-serif"]
      },
      boxShadow: {
        glass: "0 20px 40px rgba(5, 7, 9, 0.55)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.15)"
      }
    }
  },
  plugins: []
};

export default config;
