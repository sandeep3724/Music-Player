// postcss.config.cjs
module.exports = {
  plugins: {
    // use the adapter package Tailwind now expects when used as a PostCSS plugin
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
