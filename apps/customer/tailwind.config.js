/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        Jakarta: ["Jakarta", "sans-serif"],
        JakartaBold: ["Jakarta-Bold", "sans-serif"],
        JakartaExtraBold: ["Jakarta-ExtraBold", "sans-serif"],
        JakartaExtraLight: ["Jakarta-ExtraLight", "sans-serif"],
        JakartaLight: ["Jakarta-Light", "sans-serif"],
        JakartaMedium: ["Jakarta-Medium", "sans-serif"],
        JakartaSemiBold: ["Jakarta-SemiBold", "sans-serif"],
      },
      colors: {
        brand: {
          100: "#FFF3E0",
          200: "#FFE0B2",
          300: "#FFCC80",
          400: "#FFB74D",
          500: "#FF9800", // Main Brand Orange
          600: "#F57C00",
          700: "#EF6C00",
          800: "#E65100",
          900: "#A63B00",
        },
        primary: {
          100: "#FFF3E0",
          200: "#FFE0B2",
          300: "#FFCC80",
          400: "#FFB74D",
          500: "#FF9800", // Main Primary is now Orange
          600: "#F57C00",
          700: "#EF6C00",
          800: "#E65100",
          900: "#E65100",
        },
        secondary: {
          100: "#FAFAFA",
          200: "#F5F5F5",
          300: "#EEEEEE",
          400: "#E0E0E0",
          500: "#1A1A1A", // Main Secondary/Text is Black
          600: "#757575",
          700: "#616161",
          800: "#424242",
          900: "#212121",
        },
        success: {
          100: "#E8F5E9",
          200: "#C8E6C9",
          300: "#A5D6A7",
          400: "#81C784",
          500: "#4CAF50", // Brand Green
          600: "#43A047",
          700: "#388E3C",
          800: "#2E7D32",
          900: "#1B5E20",
        },
        danger: {
          100: "#FFF5F5",
          200: "#FED7D7",
          300: "#FEB2B2",
          400: "#FC8181",
          500: "#F56565",
          600: "#E53E3E",
          700: "#C53030",
          800: "#9B2C2C",
          900: "#742A2A",
        },
        warning: {
          100: "#FFFBEB",
          200: "#FEF3C7",
          300: "#FDE68A",
          400: "#FACC15",
          500: "#EAB308",
          600: "#CA8A04",
          700: "#A16207",
          800: "#854D0E",
          900: "#713F12",
        },
        general: {
          100: "#CED1DD",
          200: "#858585",
          300: "#EEEEEE",
          400: "#4CAF50", // Green accent
          500: "#F6F8FA",
          600: "#E6F3FF",
          700: "#EBEBEB",
          800: "#ADADAD",
          900: "#FAF8F5", // Cream Background
        },
      },
    },
  },
  plugins: [],
};
