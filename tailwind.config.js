/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    container: {},
    screens: {
      sm: "1280px", // Mobile breakpoint
      md: "1280px", // Tablet breakpoint
      lg: "1281px", // Desktop breakpoint
      xl: "1330px", // Custom size, if necessary
      "2xl": "1536px", // Larger screens
    },
    extend: {
      fontFamily: {
        "noto-sans": ["Noto Sans Thai", "sans-serif"],
      },
    },
  },
  plugins: [],
}
