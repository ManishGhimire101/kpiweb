async function loadCurrentUser() {

    const token = localStorage.getItem("superAdminToken");

    if (!token) {
        window.location.href = "/superadmin";
        return;
    }

    try {

        const response = await fetch("/api/super-admin/me", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {

            localStorage.removeItem("superAdminToken");
            localStorage.removeItem("superAdminUser");

            window.location.href = "/superadmin";

            return;
        }

        const user = data.user;

        const usernameElement =
            document.getElementById("username");

        const avatarElement =
            document.getElementById("userAvatar");

        if (usernameElement) {
            usernameElement.textContent = user.username;
        }

        if (avatarElement) {
            avatarElement.textContent =
                user.username.substring(0, 2).toUpperCase();
        }

    } catch (error) {

        console.error("Authentication check failed:", error);

        localStorage.removeItem("superAdminToken");
        localStorage.removeItem("superAdminUser");

        window.location.href = "/superadmin";
    }
}


/* =========================
   LOGOUT
========================= */

const logoutButton =
    document.getElementById("logoutButton");

if (logoutButton) {

    logoutButton.addEventListener("click", () => {

        localStorage.removeItem("superAdminToken");
        localStorage.removeItem("superAdminUser");

        window.location.href = "/superadmin";

    });

}
async function loadDashboard() {
  const token = localStorage.getItem("superAdminToken");

  if (!token) {
    window.location.href = "/superadmin";
    return;
  }

  try {
    const response = await fetch("/api/super-admin/dashboard", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Dashboard API error:", data);

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("superAdminToken");
        localStorage.removeItem("superAdminUser");

        window.location.href = "/superadmin";
      }

      return;
    }

    const stats = data.data;

    document.getElementById("totalInstitutions").textContent =
      stats.totalInstitutions;

    document.getElementById("totalUsers").textContent =
      stats.totalUsers;

    document.getElementById("totalStudents").textContent =
      stats.totalStudents;

    document.getElementById("totalTeachers").textContent =
      stats.totalTeachers;

    document.getElementById("totalParents").textContent =
      stats.totalParents;

  } catch (error) {
    console.error("Failed to load dashboard:", error);
  }
}



/* =========================
   INITIALIZE
========================= */

loadCurrentUser();
loadDashboard();