/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",  // Only scan existing JavaScript/JSX files
    "./src/components/**/*.{js,jsx}" // Explicitly include components directory
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

