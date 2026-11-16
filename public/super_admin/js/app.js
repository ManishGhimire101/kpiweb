const mobileMenuButton = document.getElementById("mobileMenuButton");
const sidebar = document.querySelector(".sidebar");

if (mobileMenuButton) {
  mobileMenuButton.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

/* =========================
   NAVIGATION
========================= */

const navItems = document.querySelectorAll(".nav-item");
const pageTitle = document.getElementById("pageTitle");

navItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();

    navItems.forEach((nav) => {
      nav.classList.remove("active");
    });

    item.classList.add("active");

    const page = item.dataset.page;

    if (page === "dashboard") {
      pageTitle.textContent = "Dashboard";
    } else {
      pageTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);
    }

    if (window.innerWidth <= 768) {
      sidebar.classList.remove("open");
    }
  });
});

//institutation creation
const institutionForm = document.getElementById("institution-form");
const institutionMessage = document.getElementById("institution-message");

const subdomainInput = document.getElementById("subdomain");
const subdomainPreview = document.getElementById("subdomain-preview");

if (subdomainInput) {
  subdomainInput.addEventListener("input", () => {
    const value = subdomainInput.value.trim().toLowerCase();

    subdomainPreview.textContent = `${value || "abc"}.myims.com`;
  });
}

if (institutionForm) {
  institutionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = localStorage.getItem("superAdminToken");

    if (!token) {
      institutionMessage.textContent = "You are not logged in as Super Admin.";

      return;
    }

    const data = {
      name: document.getElementById("name").value,
      code: document.getElementById("code").value,
      type: document.getElementById("type").value,
      email: document.getElementById("email").value,
      phone: document.getElementById("phone").value,
      address: document.getElementById("address").value,
      website: document.getElementById("website").value,
      subdomain: document.getElementById("subdomain").value,
      themeColor: document.getElementById("themeColor").value,
      isActive: document.getElementById("isActive").checked,
    };

    try {
      institutionMessage.textContent = "Creating institution...";

      const response = await fetch("/api/super-admin/institutions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        institutionMessage.textContent =
          result.message || "Failed to create institution.";

        return;
      }

      institutionMessage.textContent = "✅ Institution created successfully!";

      console.log("Created institution:", result.institution);

      institutionForm.reset();

      document.getElementById("themeColor").value = "#2563eb";
      document.getElementById("isActive").checked = true;

      subdomainPreview.textContent = "abc.myims.com";
    } catch (error) {
      console.error("Create institution error:", error);

      institutionMessage.textContent = "❌ Server error. Please try again.";
    }
  });
}

// ==========================================
// COMPONENT LOADER
// ==========================================

async function loadComponent(elementId, componentPath) {
  try {
    const response = await fetch(componentPath);

    if (!response.ok) {
      throw new Error(`Failed to load component: ${componentPath}`);
    }

    const html = await response.text();

    document.getElementById(elementId).innerHTML = html;
  } catch (error) {
    console.error(error);
  }
}

// ==========================================
// LOAD PAGE
// ==========================================

async function loadPage(page) {
  const pageContent = document.getElementById("pageContent");

  const pageTitle = document.getElementById("pageTitle");

  // ==========================================
  // DASHBOARD
  // ==========================================

  if (page === "dashboard") {
    pageTitle.textContent = "Dashboard";

    pageContent.innerHTML = `

      <div class="welcome">

        <h2>
          Welcome back, Super Admin
        </h2>

        <p>
          Manage institutions, users, content
          and system settings from one place.
        </p>

      </div>


      <div class="stats-grid">

        <div class="stat-card">

          <div class="stat-icon">
            🏫
          </div>

          <div>
            <span>Total Institutions</span>
            <strong id="totalInstitutions">
              0
            </strong>
          </div>

        </div>


        <div class="stat-card">

          <div class="stat-icon">
            👥
          </div>

          <div>
            <span>Total Users</span>
            <strong id="totalUsers">
              0
            </strong>
          </div>

        </div>


        <div class="stat-card">

          <div class="stat-icon">
            🎓
          </div>

          <div>
            <span>Students</span>
            <strong id="totalStudents">
              0
            </strong>
          </div>

        </div>


        <div class="stat-card">

          <div class="stat-icon">
            👨‍🏫
          </div>

          <div>
            <span>Teachers</span>
            <strong id="totalTeachers">
              0
            </strong>
          </div>

        </div>


        <div class="stat-card">

          <div class="stat-icon">
            👨‍👩‍👧
          </div>

          <div>
            <span>Parents</span>
            <strong id="totalParents">
              0
            </strong>
          </div>

        </div>

      </div>


      <div class="dashboard-section">

        <div class="section-header">

          <div>

            <h2>
              Recent Activity
            </h2>

            <p>
              Latest system activity
            </p>

          </div>

        </div>


        <div
          id="activityList"
          class="activity-list"
        >

          <div class="empty-state">
            No recent activity
          </div>

        </div>

      </div>

    `;

    // IMPORTANT:
    // Dashboard HTML must exist BEFORE
    // loadDashboard() runs.

    if (typeof loadDashboard === "function") {
      await loadDashboard();
    } else {
      console.error("loadDashboard() function not found.");
    }

    return;
  }

  // ==========================================
  // INSTITUTIONS
  // ==========================================

  if (page === "institutions") {
    pageTitle.textContent = "Institutions";

    await loadInstitutionsPage();

    return;
  }
  if (page === "users") {
    pageTitle.textContent = "Users";

    await loadUsersPage();

    return;
  }

  // ==========================================
  // OTHER PAGES
  // ==========================================

  const titles = {
    users: "Users",
    posts: "Posts",
    notices: "Notices",
    gallery: "Gallery",
    programs: "Programs",
    courses: "Courses",
    activity: "Activity",
    settings: "Settings",
  };

  pageTitle.textContent = titles[page] || "Dashboard";

  pageContent.innerHTML = `

    <div class="empty-state">

      <h2>
        ${titles[page] || page}
      </h2>

      <p>
        This section is coming soon.
      </p>

    </div>

  `;
}

// ==========================================
// NAVIGATION
// ==========================================

document.addEventListener("click", (event) => {
  const navItem = event.target.closest(".nav-item");

  if (!navItem) {
    return;
  }

  event.preventDefault();

  const page = navItem.dataset.page;

  if (!page) {
    return;
  }

  // Remove active from all menu items

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Activate clicked item

  navItem.classList.add("active");

  // Load page

  loadPage(page);
});

// ==========================================
// INITIALIZE APP
// ==========================================

async function initializeApp() {
  // Load sidebar

  await loadComponent("sidebar", "/super_admin/components/sidebar.html");

  // Load navbar

  await loadComponent("navbar", "/super_admin/components/navbar.html");

  console.log("Dashboard components loaded");

  // Load dashboard initially

  await loadPage("dashboard");
  initializeMobileMenu();
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

  // Open / close sidebar
  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    sidebar.classList.toggle("open");
  });

  // Close when clicking anywhere outside the sidebar
  document.addEventListener("click", (event) => {
    if (
      sidebar.classList.contains("open") &&
      !sidebar.contains(event.target) &&
      !menuButton.contains(event.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  // Close when clicking a sidebar navigation item
  sidebar.addEventListener("click", (event) => {
    const navItem = event.target.closest("a, button");

    if (navItem && window.innerWidth <= 768) {
      sidebar.classList.remove("open");
    }
  });
}



// ==========================================
// START
// ==========================================

initializeApp();
