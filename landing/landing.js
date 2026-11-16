(function () {
  const toggle = document.querySelector(".menu-btn");
  const links = document.querySelector(".nav-links");

  const setMenu = (open) => {
    links.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  if (toggle && links) {
    toggle.addEventListener("click", () => setMenu(!links.classList.contains("open")));
    links.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenu(false);
    });
  }

  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const roleUrl = document.getElementById("roleUrl");

  const selectTab = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
    if (roleUrl && tab.dataset.url) roleUrl.textContent = tab.dataset.url;
    if (focus) tab.focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      let next = null;
      if (step) next = tabs[(i + step + tabs.length) % tabs.length];
      if (event.key === "Home") next = tabs[0];
      if (event.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        selectTab(next, true);
      }
    });
  });

  const filters = document.querySelectorAll("[data-filter]");
  const cards = document.querySelectorAll(".card[data-roles]");
  const empty = document.querySelector(".empty");

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.filter;
      let shown = 0;
      filters.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      cards.forEach((card) => {
        const match = role === "all" || card.dataset.roles.split(" ").includes(role);
        card.hidden = !match;
        if (match) shown += 1;
      });
      if (empty) empty.hidden = shown > 0;
    });
  });

  const forms = document.querySelectorAll(".finder");

  if (forms.length) {
    let portalSuffix = "." + location.host;
    const paint = () => document.querySelectorAll(".finder .suffix").forEach((s) => (s.textContent = portalSuffix));

    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.portalSuffix) portalSuffix = data.portalSuffix;
        paint();
      })
      .catch(paint);

    forms.forEach((form) => {
      const input = form.querySelector("input");
      const note = form.parentElement.querySelector(".finder-note");
      const original = note ? note.textContent : "";

      input.addEventListener("input", () => {
        if (note && note.classList.contains("err")) {
          note.textContent = original;
          note.classList.remove("err");
        }
      });

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = input.value.trim().toLowerCase();

        if (!/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(name)) {
          if (note) {
            note.textContent = "Enter your school's web address, for example sunrise.";
            note.classList.add("err");
          }
          form.classList.remove("shake");
          void form.offsetWidth;
          form.classList.add("shake");
          input.focus();
          return;
        }

        window.location.href = `${location.protocol}//${name}${portalSuffix}/`;
      });
    });
  }
})();
