// Applies the dark mode before the app renders, so the page does not flash light. A file instead of an
// inline script: the Content-Security-Policy of the image (deploy/nginx) only allows scripts from 'self'.
;(function () {
  const theme = localStorage.getItem('darkMode')
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (!theme && systemTheme) {
    localStorage.setItem('darkMode', 'true')
  }
  if (theme === 'true' || (!theme && systemTheme)) {
    document.documentElement.classList.add('dark')
  }
})()
