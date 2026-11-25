/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        paper: "#FBF9F5",
        surface: "#FFFFFF",
        mutedSurface: "#F4F1EA",
        ink: "#18181B",
        inkSecondary: "#52525B",
        fptu: "#F37021",
        gdgBlue: "#1A73E8",
        gdgGreen: "#137333",
        gdgAmber: "#B45309",
        gdgRed: "#D93025",
      },
      boxShadow: {
        brutal: "4px 4px 0 0 #18181B",
        brutalSm: "2px 2px 0 0 #18181B",
      },
    },
  },
  plugins: [],
};
