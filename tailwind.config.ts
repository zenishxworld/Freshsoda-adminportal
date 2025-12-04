import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // TailAdmin Primary Colors
        primary: {
          DEFAULT: "#3C50E0",
          light: "#5A6FE8",
          dark: "#2A3EB8",
        },
        // Success
        success: {
          DEFAULT: "#10B981",
          light: "#34D399",
          dark: "#059669",
        },
        // Warning
        warning: {
          DEFAULT: "#F59E0B",
          light: "#FBBF24",
          dark: "#D97706",
        },
        // Danger
        danger: {
          DEFAULT: "#EF4444",
          light: "#F87171",
          dark: "#DC2626",
        },
        // Neutral Grays
        gray: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
        // Background
        body: "#F1F5F9",
        // Sidebar
        sidebar: {
          DEFAULT: "#1C2434",
          light: "#24303F",
        },
        // Driver Portal Colors
        driver: {
          background: "#EEE8FF", // Blend of E9E3FF and F3EEFF
          primary: "#10B981",    // Green for main actions
          secondary: "#3C50E0",  // Blue for secondary actions
          card: "#FFFFFF",       // White cards
        },
        // Business Blue (for better contrast)
        "business-blue": {
          DEFAULT: "#2563EB",    // Blue-600 - better contrast than lighter blues
          dark: "#1D4ED8",       // Blue-700
          light: "#3B82F6",      // Blue-500
        },
        // Success Green (for better contrast)
        "success-green": {
          DEFAULT: "#059669",    // Emerald-700 - better contrast
          light: "#10B981",      // Emerald-600
          dark: "#047857",       // Emerald-800
        },
        // Accent colors (for better contrast)
        accent: {
          DEFAULT: "#059669",    // Emerald-700 - matches success-green for consistency
          foreground: "#FFFFFF", // White text for contrast
          light: "#D1FAE5",      // Emerald-50 for backgrounds
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        default: "0px 8px 13px -3px rgba(0, 0, 0, 0.07)",
        card: "0px 1px 3px rgba(0, 0, 0, 0.12)",
        "card-2": "0px 1px 2px rgba(0, 0, 0, 0.05)",
        switcher:
          "0px 2px 4px rgba(0, 0, 0, 0.2), inset 0px 2px 2px #FFFFFF, inset 0px -1px 1px rgba(0, 0, 0, 0.1)",
        "switch-1": "0px 0px 5px rgba(0, 0, 0, 0.15)",
        1: "0px 1px 3px rgba(0, 0, 0, 0.08)",
        2: "0px 1px 4px rgba(0, 0, 0, 0.12)",
        3: "0px 0px 4px rgba(0, 0, 0, 0.15)",
        4: "0px 0px 2px rgba(0, 0, 0, 0.2)",
        5: "0px 1px 5px rgba(0, 0, 0, 0.14)",
        6: "0px 3px 15px rgba(0, 0, 0, 0.1)",
        7: "0px 0px 3px rgba(0, 0, 0, 0.1)",
        8: "0px 1px 0px rgba(0, 0, 0, 0.05)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
