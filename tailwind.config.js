/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        "sora-light": ["Sora_300Light"],
        sora: ["Sora_400Regular"],
        "sora-medium": ["Sora_500Medium"],
        "sora-semibold": ["Sora_600SemiBold"],
      },
    },
  },
  plugins: [],
}