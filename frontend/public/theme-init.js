// Sets the theme before first paint so there is no flash of the wrong one. Keep in sync with
// ThemeProvider. A plain (non-module) script loaded by index.html, so it blocks rendering and
// runs first. It lives in a file because the CSP allows no inline script (S8).
(function () {
  try {
    var theme = localStorage.getItem('signpak:theme')
    if (theme !== 'light' && theme !== 'dark') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#00401a' : '#f3faf6')
  } catch (error) {}
})()
