(function () {
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  async function api(path, options = {}) {
    const headers = { Authorization: `Bearer ${getAdminToken()}` };
    let body;

    if (options.form) {
      body = options.form;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const response = await fetch(path, { method: options.method || "GET", headers, body });
    let data = {};

    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (response.status === 401) {
      adminLogout();
      throw new Error("Session expired");
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  function toast(message, type) {
    const el = document.createElement("div");
    el.className = `lms-toast ${type || ""}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function modal(html) {
    const backdrop = document.createElement("div");
    backdrop.className = "lms-backdrop";
    backdrop.innerHTML = `<div class="lms-modal">${html}</div>`;
    document.body.appendChild(backdrop);

    const handle = { el: backdrop.firstElementChild, close: () => backdrop.remove() };

    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) handle.close();
    });
    backdrop.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", handle.close));

    return handle;
  }

  const ICONS = {"profile": "<circle cx=\"12\" cy=\"8\" r=\"3.5\"/><path d=\"M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6\"/>", "home": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M8 21h8M12 17v4\"/>", "notices": "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z\"/><path d=\"M10 20a2 2 0 0 0 4 0\"/>", "gallary": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><circle cx=\"9\" cy=\"10\" r=\"1.6\"/><path d=\"m21 16-5-5-9 9\"/>", "staff": "<circle cx=\"9\" cy=\"8\" r=\"3.2\"/><path d=\"M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5\"/><circle cx=\"17.5\" cy=\"9\" r=\"2.4\"/><path d=\"M17 14.6c2.4.2 4 1.9 4 4.4\"/>", "about": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5M12 8h.01\"/>", "programs": "<path d=\"M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z\"/><path d=\"M4 19a2 2 0 0 1 2-2h13\"/>"};

  const SECTIONS = [
    { id: "profile", label: "Profile & logo", hint: "Logo, contact details, address and map" },
    { id: "home", label: "Home slides", hint: "Banner images on the home page", category: "home", noun: "slide", titleLabel: "Headline", detailsLabel: "Caption" },
    { id: "notices", label: "Notices", hint: "Announcements shown on the notice page", category: "notices", noun: "notice", titleLabel: "Title", detailsLabel: "Details" },
    { id: "gallary", label: "Gallery", hint: "Photos shown in the gallery", category: "gallary", noun: "photo", titleLabel: "Title", detailsLabel: "Description" },
    { id: "staff", label: "Staff", hint: "Teachers and staff shown on the staff page", category: "staff", noun: "staff profile", titleLabel: "Name", detailsLabel: "Role / bio" },
    { id: "about", label: "About", hint: "Content for the about page", category: "about", noun: "about item", titleLabel: "Heading", detailsLabel: "Text" },
    { id: "programs", label: "Programs & courses", hint: "Programs and the courses inside them" },
  ];

  window.initializeWebsite = function initializeWebsite() {
    const tabs = document.getElementById("webTabs");
    const body = document.getElementById("webBody");
    let current = sessionStorage.getItem("webSection") || "profile";

    function drawTabs() {
      tabs.innerHTML = SECTIONS.map(
        (s) => `<button class="web-menu-item ${s.id === current ? "active" : ""}" data-sec="${s.id}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[s.id]}</svg>
          <span>${esc(s.label)}</span></button>`,
      ).join("");
      tabs.querySelectorAll("[data-sec]").forEach((b) =>
        b.addEventListener("click", () => {
          current = b.dataset.sec;
          sessionStorage.setItem("webSection", current);
          drawTabs();
          show();
        }),
      );
    }

    async function show() {
      const section = SECTIONS.find((s) => s.id === current);
      document.getElementById("webHead").innerHTML = `<h2>${esc(section.label)}</h2><p>${esc(section.hint)}</p>`;
      body.innerHTML = '<div class="lms-empty">Loading...</div>';

      try {
        if (section.id === "profile") await renderProfile(body);
        else if (section.id === "programs") await renderPrograms(body);
        else await renderUploads(body, section);
      } catch (error) {
        body.innerHTML = `<div class="lms-empty">${esc(error.message)}</div>`;
      }
    }

    drawTabs();
    show();
  };

  async function renderProfile(body) {
    const p = (await api("/api/admin/content/profile")).data;

    body.innerHTML = `<div class="lms-card" style="max-width:640px">
      <form>
        <div class="lms-error" hidden></div>
        <div class="lms-field"><label>Logo</label>
          ${p.logo ? `<img src="${esc(p.logo)}" alt="Logo" style="height:70px;margin-bottom:8px;display:block">` : '<div class="lms-muted" style="margin-bottom:6px">No logo uploaded. Initials are shown instead.</div>'}
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif"></div>
        <div class="lms-field"><label>Institute name</label><input value="${esc(p.name)}" disabled>
          <div class="lms-muted">The name, code and web address are managed by the platform administrator.</div></div>
        <div class="lms-row">
          <div class="lms-field"><label>Type</label><input name="type" value="${esc(p.type || "")}" placeholder="School, College..."></div>
          <div class="lms-field"><label>Phone</label><input name="phone" value="${esc(p.phone || "")}"></div>
        </div>
        <div class="lms-row">
          <div class="lms-field"><label>Email</label><input type="email" name="email" value="${esc(p.email || "")}"></div>
          <div class="lms-field"><label>Website</label><input name="website" value="${esc(p.website || "")}" placeholder="https://"></div>
        </div>
        <div class="lms-field"><label>Address</label><input name="address" value="${esc(p.address || "")}" maxlength="300"></div>
        <div class="lms-field"><label>Google Maps embed iframe</label><textarea name="mapEmbedUrl" rows="4" placeholder="Paste the full Google Maps &lt;iframe ...&gt; embed code here">${esc(p.mapEmbedUrl || "")}</textarea><div class="lms-muted">In Google Maps, select Share → Embed a map → Copy HTML, then paste the entire iframe code here. This will appear on your About Us page.</div></div>
        <div class="lms-actions"><button class="lms-btn" type="submit">Save profile</button></div>
      </form></div>`;

    const form = body.querySelector("form");
    const error = form.querySelector(".lms-error");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;

      try {
        const data = new FormData(form);
        if (!data.get("logo").size) data.delete("logo");
        await api("/api/admin/content/profile", { method: "PUT", form: data });
        toast("Profile saved", "success");
        renderProfile(body);
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
  }

  async function renderUploads(body, section) {
    const items = (await api(`/api/admin/content/uploads?category=${section.category}`)).data;

    body.innerHTML = `<div class="lms-head" style="margin-bottom:12px"><div class="lms-muted">${items.length} ${esc(section.noun)}(s)</div>
      <button class="lms-btn" id="addItem">+ Add ${esc(section.noun)}</button></div>
      ${
        items.length
          ? `<div class="lms-grid">${items
              .map(
                (i) => `<div class="lms-card"><img class="lms-thumb" src="${esc(i.imageUrl)}" alt="">
              <h3>${esc(i.title || "Untitled")}</h3><div class="lms-muted">${esc((i.details || "").slice(0, 120))}</div>
              <div class="lms-actions" style="justify-content:flex-start"><button class="lms-btn small secondary" data-edit="${i.id}">Edit</button>
              <button class="lms-btn small danger" data-del="${i.id}">Delete</button></div></div>`,
              )
              .join("")}</div>`
          : `<div class="lms-empty">Nothing here yet. Add your first ${esc(section.noun)}.</div>`
      }`;

    function form(item) {
      const m = modal(`<h3>${item ? "Edit" : "Add"} ${esc(section.noun)}</h3>
        <form>
          <div class="lms-error" hidden></div>
          ${item ? "" : '<div class="lms-field"><label>Image *</label><input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif" required><div class="lms-muted">JPG, PNG, WEBP or GIF, up to 5MB.</div></div>'}
          <div class="lms-field"><label>${esc(section.titleLabel)} *</label><input name="title" required maxlength="200" value="${esc(item ? item.title : "")}"></div>
          <div class="lms-field"><label>${esc(section.detailsLabel)}</label><textarea name="details" maxlength="5000">${esc(item ? item.details || "" : "")}</textarea></div>
          <div class="lms-actions"><button type="button" class="lms-btn secondary" data-close>Cancel</button><button class="lms-btn" type="submit">Save</button></div>
        </form>`);

      const f = m.el.querySelector("form");
      const error = f.querySelector(".lms-error");

      f.addEventListener("submit", async (event) => {
        event.preventDefault();
        error.hidden = true;

        try {
          if (item) {
            await api(`/api/admin/content/uploads/${item.id}`, { method: "PUT", body: Object.fromEntries(new FormData(f)) });
          } else {
            await api(`/api/admin/content/uploads/${section.category}`, { method: "POST", form: new FormData(f) });
          }
          m.close();
          toast("Saved", "success");
          renderUploads(body, section);
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
        }
      });
    }

    body.querySelector("#addItem").addEventListener("click", () => form(null));
    body.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => form(items.find((i) => String(i.id) === b.dataset.edit))));
    body.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this item from your website?")) return;

        try {
          await api(`/api/admin/content/uploads/${b.dataset.del}`, { method: "DELETE" });
          toast("Deleted", "success");
          renderUploads(body, section);
        } catch (err) {
          toast(err.message, "error");
        }
      }),
    );
  }

  async function renderPrograms(body) {
    const programs = (await api("/api/admin/content/programs")).data;

    body.innerHTML = `<div class="lms-head" style="margin-bottom:12px"><div class="lms-muted">${programs.length} program(s)</div>
      <button class="lms-btn" id="addProgram">+ Add program</button></div>
      ${
        programs.length
          ? programs
              .map(
                (p) => `<div class="lms-card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
              <div><h3>${esc(p.name)}</h3><div class="lms-muted">${esc(p.details || "")}</div></div>
              <div><button class="lms-btn small secondary" data-edit-p="${p.id}">Edit</button>
              <button class="lms-btn small danger" data-del-p="${p.id}">Delete</button></div></div>
              <div style="margin:10px 0">${
                p.courses.length
                  ? p.courses.map((c) => `<span class="lms-chip">${esc(c.title)}${c.isFree ? " (Free)" : ""} <a href="#" data-del-c="${c.id}" style="color:#b91c1c;text-decoration:none">&times;</a></span>`).join("")
                  : '<span class="lms-muted">No courses yet.</span>'
              }</div>
              <button class="lms-btn small" data-add-c="${p.id}">+ Add course</button>
              <button class="lms-btn small secondary" data-manage-fees>Manage program/course fees</button></div>`,
              )
              .join("")
          : '<div class="lms-empty">No programs yet. Programs and courses appear on your Program page and home page.</div>'
      }`;

    const find = (id) => programs.find((p) => String(p.id) === String(id));

    function programForm(p) {
      const m = modal(`<h3>${p ? "Edit" : "Add"} program</h3><form>
        <div class="lms-error" hidden></div>
        <div class="lms-field"><label>Name *</label><input name="name" required maxlength="120" value="${esc(p ? p.name : "")}"></div>
        <div class="lms-field"><label>Details</label><textarea name="details" maxlength="2000">${esc(p ? p.details || "" : "")}</textarea></div>
        <div class="lms-actions"><button type="button" class="lms-btn secondary" data-close>Cancel</button><button class="lms-btn" type="submit">Save</button></div></form>`);
      const f = m.el.querySelector("form");
      f.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await api(p ? `/api/admin/content/programs/${p.id}` : "/api/admin/content/programs", { method: p ? "PUT" : "POST", body: Object.fromEntries(new FormData(f)) });
          m.close();
          renderPrograms(body);
        } catch (err) {
          const e = f.querySelector(".lms-error");
          e.textContent = err.message;
          e.hidden = false;
        }
      });
    }

    function courseForm(programId) {
      const m = modal(`<h3>Add course</h3><form>
        <div class="lms-error" hidden></div>
        <div class="lms-field"><label>Title *</label><input name="title" required maxlength="150"></div>
        <div class="lms-field"><label>Details</label><textarea name="details" maxlength="2000"></textarea></div>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="isFree"> Free course</label>
        <div class="lms-actions"><button type="button" class="lms-btn secondary" data-close>Cancel</button><button class="lms-btn" type="submit">Add course</button></div></form>`);
      const f = m.el.querySelector("form");
      f.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(f));
        data.isFree = f.isFree.checked;
        try {
          await api(`/api/admin/content/programs/${programId}/courses`, { method: "POST", body: data });
          m.close();
          renderPrograms(body);
        } catch (err) {
          const e = f.querySelector(".lms-error");
          e.textContent = err.message;
          e.hidden = false;
        }
      });
    }

    body.querySelector("#addProgram").addEventListener("click", () => programForm(null));
    body.querySelectorAll("[data-edit-p]").forEach((b) => b.addEventListener("click", () => programForm(find(b.dataset.editP))));
    body.querySelectorAll("[data-add-c]").forEach((b) => b.addEventListener("click", () => courseForm(b.dataset.addC)));
    body.querySelectorAll("[data-manage-fees]").forEach((b) => b.addEventListener("click", () => {
      const link = document.querySelector('[data-page="fees"], [data-view="fees"], a[href*="fees"]');
      if (link) link.click(); else toast("Open Fees & Billing to create plans for this program or its courses.", "info");
    }));

    body.querySelectorAll("[data-del-p]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this program and all its courses?")) return;
        try {
          await api(`/api/admin/content/programs/${b.dataset.delP}`, { method: "DELETE" });
          renderPrograms(body);
        } catch (err) {
          toast(err.message, "error");
        }
      }),
    );

    body.querySelectorAll("[data-del-c]").forEach((a) =>
      a.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          await api(`/api/admin/content/courses/${a.dataset.delC}`, { method: "DELETE" });
          renderPrograms(body);
        } catch (err) {
          toast(err.message, "error");
        }
      }),
    );
  }
})();
