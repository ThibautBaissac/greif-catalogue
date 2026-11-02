// Personnes : filtre par rôle. Reprend `prototype/assets/app.js`.
const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".chip[data-role]"));

if (chips.length > 0) {
  const items = Array.from(document.querySelectorAll<HTMLElement>("ul.persons > li"));
  const sections = Array.from(document.querySelectorAll<HTMLElement>("section.letter"));
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      for (const c of chips) c.setAttribute("aria-pressed", String(c === chip));
      const role = chip.dataset.role;
      for (const li of items) li.hidden = role !== "all" && !(li.dataset.roles ?? "").split(" ").includes(role ?? "");
      for (const section of sections) section.hidden = !Array.from(section.querySelectorAll<HTMLElement>("li")).some(li => !li.hidden);
    });
  }
}
