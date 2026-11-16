const superAdminToken = localStorage.getItem("superAdminToken");

function superAdminSignOut() {
    localStorage.removeItem("superAdminToken");
    localStorage.removeItem("superAdminUser");
    window.location.replace("/superadmin");
}

function superAdminStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("superAdminUser"));
    } catch (error) {
        return null;
    }
}

if (!superAdminToken) {
    superAdminSignOut();
} else if ((superAdminStoredUser() || {}).mustChangePassword) {
    window.location.replace("/superadmin/change-password");
}

document.addEventListener("click", (event) => {
    if (event.target.closest("#logoutButton")) {
        event.preventDefault();
        superAdminSignOut();
    }
});
