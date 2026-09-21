/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          violet: "#8E78D8",
          blue: "#7E8FEF",
          "soft-blue": "#A7B4FF",
          pink: "#E38AA6",
          rose: "#C95A6E",
          bg: "#ECE3F2",
          surface: "#FFFFFF",
          border: "#DFD3E6",
          text: "#2A2233",
          muted: "#6D6478",
          success: "#34C38F",
          warning: "#F0A500",
          danger: "#E25564",
        },
      },
      fontFamily: {
        sans: ["Inter", "Koulen", "Kulen", "Noto Sans Khmer", "system-ui", "sans-serif"],
        heading: ["Koulen", "Kulen", "Poppins", "Inter", "sans-serif"],
        kulen: ["Koulen", "Kulen", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        button: "12px",
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(142, 120, 216, 0.08)",
        glow: "0 0 25px rgba(142, 120, 216, 0.35)",
        "glow-rose": "0 0 25px rgba(201, 90, 110, 0.35)",
        card: "0 2px 12px rgba(42, 34, 51, 0.04), 0 1px 3px rgba(42, 34, 51, 0.02)",
      },
    },
  },
  plugins: [],
};
