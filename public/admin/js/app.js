document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAdminLogin()) {
    return;
  }

  const passwordState = await adminPasswordState();

  if (passwordState === "expired") {
    adminLogout();
    return;
  }

  if (passwordState === "change") {
    window.location.replace("/admin/change-password");
    return;
  }

  await loadNavbar();

  await loadSidebar();

  initializeAdminInterface();
});

async function adminPasswordState() {
  try {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    });

    if (response.status === 401) {
      return "expired";
    }

    const data = await response.json();

    if (data.user) {
      localStorage.setItem("adminUser", JSON.stringify(data.user));
      localStorage.setItem("portalUser", JSON.stringify(data.user));
      localStorage.setItem("portalToken", getAdminToken());
    }

    return data.user && data.user.mustChangePassword ? "change" : "ok";
  } catch (error) {
    return "ok";
  }
}

async function loadNavbar() {
  try {
    const response = await fetch("/admin/components/navbar.html");

    if (!response.ok) {
      throw new Error("Failed to load navbar");
    }

    const html = await response.text();

    const navbar = document.getElementById("navbar");

    if (navbar) {
      navbar.innerHTML = html;
    }
  } catch (error) {
    console.error("Navbar loading error:", error);
  }
}

async function loadSidebar() {
  try {
    const response = await fetch("/admin/components/sidebar.html");

    if (!response.ok) {
      throw new Error("Failed to load sidebar");
    }

    const html = await response.text();

    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
      sidebar.innerHTML = html;
    }
  } catch (error) {
    console.error("Sidebar loading error:", error);
  }
}

function initializeAdminInterface() {
  const user = getAdminUser();

  if (!user) {
    return;
  }

  const navbarUsername = document.getElementById("navbarUsername");

  if (navbarUsername) {
    navbarUsername.textContent = user.username;
  }

  const userInitial = document.getElementById("userInitial");

  if (userInitial && user.username) {
    userInitial.textContent = user.username.charAt(0).toUpperCase();
  }

  if (user.institution) {
    const institution = user.institution;

    const navbarInstitutionName = document.getElementById(
      "navbarInstitutionName",
    );

    if (navbarInstitutionName) {
      navbarInstitutionName.textContent = institution.name;
    }

    applyNavbarLogo(institution);
  }

  initializeMobileMenu();

  initializeLogout();
}

function initializeMobileMenu() {
  const menuButton = document.getElementById("mobileMenuButton");

  const sidebar = document.querySelector(".sidebar");

  if (!menuButton || !sidebar) {
    console.error("Mobile menu or sidebar not found");

    return;
  }

  if (menuButton.dataset.menuInitialized === "true") {
    return;
  }

  menuButton.dataset.menuInitialized = "true";

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();

    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (
      sidebar.classList.contains("open") &&
      !sidebar.contains(event.target) &&
      !menuButton.contains(event.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  sidebar.addEventListener("click", (event) => {
    const navItem = event.target.closest("a, button");

    if (navItem && window.innerWidth <= 768) {
      sidebar.classList.remove("open");
    }
  });
}

function initializeLogout() {
  const logoutButton = document.getElementById("logoutButton");

  const sidebarLogoutButton = document.getElementById("sidebarLogoutButton");

  if (logoutButton) {
    logoutButton.addEventListener("click", adminLogout);
  }

  if (sidebarLogoutButton) {
    sidebarLogoutButton.addEventListener("click", adminLogout);
  }
}

async function loadPage(page) {
  page = page.trim();

  const pageContent = document.getElementById("pageContent");

  if (!pageContent) {
    console.error("pageContent not found");
    return;
  }

  try {
    pageContent.innerHTML = `
            <div class="page-loading">
                Loading...
            </div>
        `;

    const response = await fetch(`/admin/components/${page}.html`);

    if (!response.ok) {
      throw new Error(`Failed to load ${page}`);
    }

    const html = await response.text();

    pageContent.innerHTML = html;

    updateActiveSidebar(page);

    if (page === "students") {
      if (typeof initializeStudents === "function") {
        initializeStudents();
      }

      if (typeof initializeAdmissionModal === "function") {
        initializeAdmissionModal();
      }
    }
    if (page === "parents" && typeof initializeParents === "function") {
      initializeParents();
    }

    if (page === "teachers" && typeof initializeTeachers === "function") {
      initializeTeachers();
    }

    if (page === "website" && typeof initializeWebsite === "function") {
      initializeWebsite();
    }

    if (page === "classes" && typeof initializeClasses === "function") {
      initializeClasses();
    }

    if (page === "dashboard") {
      pageContent.innerHTML = `
        <div class="page-loading">
            Loading...
        </div>
    `;

      const response = await fetch("/admin/components/dashboard.html");

      if (!response.ok) {
        throw new Error("Failed to load dashboard");
      }

      const html = await response.text();

      pageContent.innerHTML = html;

      updateActiveSidebar("dashboard");

      if (typeof initializeDashboard === "function") {
        initializeDashboard();
      }

      return;
    }
  } catch (error) {
    console.error("Page loading error:", error);

    pageContent.innerHTML = `
            <div class="page-error">
                <h2>Unable to load page</h2>
                <p>${error.message}</p>
            </div>
        `;
  }
}

function getPageFromURL() {
  const path = window.location.pathname.trim();

  const pages = {
    "/admin": "dashboard",
    "/admin/": "dashboard",
    "/admin/dashboard": "dashboard",

    "/admin/students": "students",
    "/admin/teachers": "teachers",
    "/admin/classes": "classes",
    "/admin/website": "website",
    "/admin/parents": "parents",
    "/admin/programs": "programs",
    "/admin/courses": "courses",
    "/admin/notices": "notices",
    "/admin/uploads": "uploads",
    "/admin/settings": "settings",
  };

  return pages[path] || "dashboard";
}

function loadInitialPage() {
  const page = getPageFromURL();

  updateActiveSidebar(page);

  loadPage(page);
}

function initializePageNavigation() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-page]");

    if (!link) {
      return;
    }

    event.preventDefault();

    const page = link.dataset.page?.trim();

    if (!page) {
      return;
    }

    const url = link.getAttribute("href");

    updateActiveSidebar(page);

    loadPage(page);

    if (url) {
      window.history.pushState({ page: page }, "", url);
    }
  });
}

window.addEventListener("popstate", () => {
  const page = getPageFromURL();

  loadPage(page);
});

function updateActiveSidebar(page) {
  const sidebar = document.getElementById("sidebar");

  if (!sidebar) {
    console.error("Sidebar not found");
    return;
  }

  const links = sidebar.querySelectorAll("a[data-page]");

  console.log("Updating sidebar:", page);

  links.forEach((link) => {
    console.log("Sidebar link:", link.dataset.page, "Current page:", page);

    if (link.dataset.page === page) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAdminLogin()) {
    return;
  }

  await loadNavbar();

  await loadSidebar();

  initializeAdminInterface();

  initializePageNavigation();

  loadInitialPage();
});


async function applyNavbarLogo(institution) {
  const holder = document.getElementById("navbarInstitutionLogo");

  if (!holder) {
    return;
  }

  let logo = institution.logo || "";

  if (!logo) {
    try {
      const response = await fetch("/api/config");
      const data = await response.json();
      logo = (data.institution && data.institution.logo) || "";
    } catch (error) {
      logo = "";
    }
  }

  holder.textContent = "";

  if (logo) {
    const img = document.createElement("img");
    img.src = logo;
    img.alt = "";
    holder.appendChild(img);
  } else {
    holder.textContent = (institution.name || "I").charAt(0).toUpperCase();
  }
}
