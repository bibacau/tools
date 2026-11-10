/** Keep return navigation inside the application, including a direct tool URL. */
const key = "personalOSDepth";
export function navigationDepth(): number | null {
  const value = window.history.state?.[key];
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export function initializeNavigation() {
  if (navigationDepth() !== null) return;
  const entry =
    window.location.pathname + window.location.search + window.location.hash;
  window.history.replaceState({ [key]: 0 }, "", "/");
  if (entry !== "/") window.history.pushState({ [key]: 1 }, "", entry);
}
export function navigateTo(page: string) {
  const target = page === "dashboard" ? "/" : "/" + page;
  if (
    window.location.pathname + window.location.search + window.location.hash ===
    target
  )
    return;
  window.history.pushState({ [key]: (navigationDepth() ?? 0) + 1 }, "", target);
}
export function canReturn() {
  return (navigationDepth() ?? 0) > 0 || window.location.pathname !== "/";
}
export function returnToPreviousPage() {
  if ((navigationDepth() ?? 0) > 0) {
    window.history.back();
    return;
  }
  if (window.location.pathname !== "/") {
    window.history.replaceState({ [key]: 0 }, "", "/");
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: window.history.state }),
    );
  }
  // Android Back at the dashboard stays here. The OS Home control still leaves the app.
}
