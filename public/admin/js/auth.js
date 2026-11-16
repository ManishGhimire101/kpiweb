const ADMIN_TOKEN_KEY = "adminToken";
const ADMIN_USER_KEY = "adminUser";


function getAdminToken() {

    return localStorage.getItem(
        ADMIN_TOKEN_KEY
    );

}


function getAdminUser() {

    const user =
        localStorage.getItem(
            ADMIN_USER_KEY
        );

    if (!user) {
        return null;
    }

    try {

        return JSON.parse(user);

    } catch (error) {

        console.error(
            "Invalid admin user data",
            error
        );

        return null;
    }

}


function clearAdminSession() {

    [
        ADMIN_TOKEN_KEY,
        ADMIN_USER_KEY,
        "portalToken",
        "portalUser"
    ].forEach((key) => localStorage.removeItem(key));

}


function adminLogout() {

    clearAdminSession();

    window.location.href =
        "/login";

}


function requireAdminLogin() {

    const token =
        getAdminToken();

    const user =
        getAdminUser();


    if (!token || !user || user.role !== "ADMIN") {

        clearAdminSession();

        window.location.href =
            "/login";

        return false;
    }


    return true;

}
