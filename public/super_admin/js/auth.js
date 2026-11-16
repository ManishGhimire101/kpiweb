const superAdminToken = localStorage.getItem("superAdminToken");

if (!superAdminToken) {
    window.location.href = "/superadmin";
}