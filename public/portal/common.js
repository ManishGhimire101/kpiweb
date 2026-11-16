(function () {
  const TOKEN_KEY = "portalToken";
  const USER_KEY = "portalUser";

  const Portal = {};

  Portal.esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  Portal.token = () => localStorage.getItem(TOKEN_KEY);

  Portal.user = () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (error) {
      return null;
    }
  };

  Portal.save = (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    if (user.role === "ADMIN") {
      localStorage.setItem("adminToken", token);
      localStorage.setItem("adminUser", JSON.stringify(user));
    }
  };

  Portal.clear = () => {
    [TOKEN_KEY, USER_KEY, "adminToken", "adminUser"].forEach((key) => localStorage.removeItem(key));
  };

  Portal.homeFor = (role) =>
    ({ ADMIN: "/admin", TEACHER: "/teacher", STUDENT: "/student", PARENT: "/parent" })[role] || "/login";

  Portal.logout = () => {
    Portal.clear();
    window.location.href = "/login";
  };

  Portal.api = async (path, options = {}) => {
    const headers = {};
    const token = Portal.token();

    if (token) headers.Authorization = `Bearer ${token}`;

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

    if (response.status === 403 && data.code === "PASSWORD_CHANGE_REQUIRED") {
      window.location.replace("/change-password");
      throw new Error(data.message);
    }

    if (response.status === 401 && token && !options.noRedirect) {
      Portal.logout();
      throw new Error("Session expired. Please sign in again.");
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  };

  Portal.toast = (message, type) => {
    let host = document.querySelector(".toast-host");

    if (!host) {
      host = document.createElement("div");
      host.className = "toast-host";
      document.body.appendChild(host);
    }

    const el = document.createElement("div");
    el.className = `toast ${type || ""}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  Portal.fmtDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  Portal.fmtDateTime = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  Portal.toInputDate = (date) => {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const BADGES = {
    PENDING: ["warn", "Pending"],
    OVERDUE: ["bad", "Overdue"],
    SUBMITTED: ["info", "Submitted"],
    REVIEWED: ["ok", "Reviewed"],
    PRESENT: ["ok", "Present"],
    ABSENT: ["bad", "Absent"],
    LATE: ["warn", "Late"],
    EXCUSED: ["info", "Excused"],
  };

  Portal.badge = (status) => {
    const [kind, label] = BADGES[status] || ["muted", status];
    return `<span class="badge ${kind}">${Portal.esc(label)}</span>`;
  };

  Portal.formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  Portal.filesHtml = (files) => {
    if (!files || !files.length) return "";

    return `<div class="files">${files
      .map(
        (file) =>
          `<button type="button" class="file-link" data-url="${Portal.esc(file.url)}" data-name="${Portal.esc(file.name)}">&#128206; ${Portal.esc(file.name)} <span class="muted">(${Portal.formatSize(file.size)})</span></button>`,
      )
      .join("")}</div>`;
  };

  Portal.download = async (url, name) => {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${Portal.token()}` } });

      if (!response.ok) {
        throw new Error("File could not be downloaded");
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) {
      Portal.toast(error.message, "error");
    }
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".file-link");

    if (button) {
      Portal.download(button.dataset.url, button.dataset.name);
    }
  });

  Portal.modal = (html, options = {}) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal ${options.wide ? "wide" : ""}">${html}</div>`;
    document.body.appendChild(backdrop);

    const api = {
      el: backdrop.firstElementChild,
      close: () => backdrop.remove(),
    };

    if (!options.locked) {
      backdrop.addEventListener("mousedown", (event) => {
        if (event.target === backdrop) api.close();
      });
    }

    backdrop.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", api.close));

    return api;
  };

  Portal.credentials = (title, creds) => {
    const modal = Portal.modal(`
      <h3>${Portal.esc(title)}</h3>
      <p class="muted small">Share these login details with the user. The password is shown only once and must be changed on first sign-in.</p>
      <div class="cred-box">Username: ${Portal.esc(creds.username)}<br>Temporary password: ${Portal.esc(creds.temporaryPassword)}</div>
      <div class="modal-actions">
        <button class="btn secondary" data-copy>Copy</button>
        <button class="btn" data-close>Done</button>
      </div>`);

    modal.el.querySelector("[data-copy]").addEventListener("click", () => {
      navigator.clipboard
        .writeText(`Username: ${creds.username}\nPassword: ${creds.temporaryPassword}`)
        .then(() => Portal.toast("Copied", "success"))
        .catch(() => Portal.toast("Copy failed", "error"));
    });
  };

  Portal.start = async function start(options) {
    const user = Portal.user();

    if (!Portal.token() || !user || user.role !== options.role) {
      window.location.href = user && Portal.token() ? Portal.homeFor(user.role) : "/login";
      return;
    }

    let fresh;

    try {
      fresh = (await Portal.api("/api/auth/me")).user;
      Portal.save(Portal.token(), fresh);
    } catch (error) {
      Portal.logout();
      return;
    }

    if (fresh.mustChangePassword) {
      window.location.replace("/change-password");
      return;
    }

    if (fresh.institution && fresh.institution.themeColor) {
      document.documentElement.style.setProperty("--brand", fresh.institution.themeColor);
    }

    document.title = `${options.title} - ${fresh.institution.name}`;

    const app = document.getElementById("app");
    app.innerHTML = `
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand"><strong>${Portal.esc(fresh.institution.name)}</strong><small>${Portal.esc(options.title)}</small></div>
          <div class="user-box">
            <span>${Portal.esc((fresh.profile && fresh.profile.name) || fresh.username)}</span>
            <button class="btn small" id="pwBtn">Password</button>
            <button class="btn small" id="logoutBtn">Sign out</button>
          </div>
        </div>
        <nav class="tabs" id="tabs"></nav>
      </header>
      <main class="container" id="view"></main>`;

    document.getElementById("logoutBtn").addEventListener("click", Portal.logout);
    document.getElementById("pwBtn").addEventListener("click", () => (window.location.href = "/change-password"));

    const tabsEl = document.getElementById("tabs");
    const view = document.getElementById("view");

    tabsEl.innerHTML = options.tabs
      .map((tab) => `<button class="tab" data-tab="${tab.id}">${Portal.esc(tab.label)}</button>`)
      .join("");

    async function show(id) {
      const tab = options.tabs.find((t) => t.id === id) || options.tabs[0];

      tabsEl.querySelectorAll(".tab").forEach((el) => el.classList.toggle("active", el.dataset.tab === tab.id));
      history.replaceState(null, "", `#${tab.id}`);
      view.innerHTML = '<div class="empty">Loading...</div>';

      try {
        await tab.render(view, fresh);
      } catch (error) {
        view.innerHTML = `<div class="empty">${Portal.esc(error.message)}</div>`;
      }
    }

    tabsEl.addEventListener("click", (event) => {
      const button = event.target.closest(".tab");
      if (button) show(button.dataset.tab);
    });

    Portal.refresh = () => show(location.hash.slice(1));

    show(location.hash.slice(1));
  };

  window.Portal = Portal;
})();
