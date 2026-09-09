// Apply appearance before the first paint, including when storage is unavailable.
(() => {
  let appearance = "system";
  try {
    const saved = JSON.parse(localStorage.getItem("grimoire-browser-preferences") || "{}");
    if (saved && (saved.appearance === "dark" || saved.appearance === "light")) appearance = saved.appearance;
  } catch { /* Use the system preference. */ }
  const dark = appearance === "dark" || (appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
})();
