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


function adminLogout() {

    localStorage.removeItem(
        ADMIN_TOKEN_KEY
    );

    localStorage.removeItem(
        ADMIN_USER_KEY
    );

    window.location.href =
        "/admin/login";

}


function requireAdminLogin() {

    const token =
        getAdminToken();

    const user =
        getAdminUser();


    if (!token || !user) {

        window.location.href =
            "/admin/login";

        return false;
    }


    if (user.role !== "ADMIN") {

        localStorage.removeItem(
            ADMIN_TOKEN_KEY
        );

        localStorage.removeItem(
            ADMIN_USER_KEY
        );

        window.location.href =
            "/admin/login";

        return false;
    }


    return true;

}