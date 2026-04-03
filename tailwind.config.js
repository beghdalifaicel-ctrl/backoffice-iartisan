/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ia: {
          bg: "#f7f4ef",
          dark: "#1a1a14",
          accent: "#ff5c00",
          "accent-hover": "#e54e00",
          green: "#2d6a4f",
          muted: "#7a7a6a",
          surface: "#ffffff",
          border: "#e5e0d8",
          yellow: "#f4d03f",
        },
      },
      fontFamily: {
        sans: ["Bricolage Grotesque", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      borderRadius: {
        ia: "16px",
        "ia-sm": "10px",
        "ia-pill": "20px",
      },
      boxShadow: {
        ia: "0 20px 60px rgba(26,26,20,.1)",
        "ia-sm": "0 8px 32px rgba(26,26,20,.08)",
        "ia-accent": "0 4px 20px rgba(255,92,0,.35)",
      },
    },
  },
  plugins: [],
};
