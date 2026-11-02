/** Interface Pagefind. Les fichiers /pagefind/* n'existent qu'après `npm run build`. */
type PagefindUI = { triggerSearch(query: string): void };
declare global {
  interface Window {
    PagefindUI?: new (options: Record<string, unknown>) => PagefindUI;
  }
}

const container = document.querySelector<HTMLElement>("#search");
if (container) {
  if (window.PagefindUI) {
    const ui = new window.PagefindUI({
      element: "#search",
      showSubResults: true,
      showImages: false,
      translations: { placeholder: container.dataset.placeholder ?? "" },
    });
    const q = new URLSearchParams(location.search).get("q");
    if (q) ui.triggerSearch(q);
  } else {
    container.textContent = container.dataset.unavailable ?? "";
  }
}
export {};
