function initializeDashboard() {
    loadAdminInformation();
    loadDashboard();
}


function loadAdminInformation() {

    const user = getAdminUser();

    if (!user) {
        return;
    }

    const username =
        document.getElementById("adminUsername");

    const institutionName =
        document.getElementById("institutionName");


    if (username) {
        username.textContent = user.username;
    }


    if (institutionName) {

        if (user.institution) {

            institutionName.textContent =
                `${user.institution.name} (${user.institution.code})`;

        } else {

            institutionName.textContent =
                "Institution information unavailable";
        }
    }
}


async function loadDashboard() {

    const token = getAdminToken();

    if (!token) {
        return;
    }

    try {

        const response = await fetch(
            "/api/admin/dashboard",
            {
                method: "GET",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data = await response.json();


        if (!response.ok) {

            if (response.status === 401) {
                adminLogout();
                return;
            }

            throw new Error(
                data.message ||
                "Failed to load dashboard"
            );
        }


        console.log(
            "Admin dashboard:",
            data
        );


        if (
            data.success &&
            data.data &&
            data.data.counts
        ) {

            const counts = data.data.counts;


            const studentCount =
                document.getElementById("studentCount");

            const teacherCount =
                document.getElementById("teacherCount");

            const parentCount =
                document.getElementById("parentCount");

            const programCount =
                document.getElementById("programCount");


            if (studentCount) {
                studentCount.textContent =
                    counts.students;
            }

            if (teacherCount) {
                teacherCount.textContent =
                    counts.teachers;
            }

            if (parentCount) {
                parentCount.textContent =
                    counts.parents;
            }

            if (programCount) {
                programCount.textContent =
                    counts.programs;
            }
        }

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );
    }
}