const token = localStorage.getItem("adminToken");

if (!token) {
    window.location.href = "/admin/login";
}

document
    .getElementById("changePasswordForm")
    .addEventListener("submit", async (event) => {

        event.preventDefault();

        const currentPassword =
            document.getElementById("currentPassword").value;

        const newPassword =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        const message =
            document.getElementById("message");

        if (newPassword !== confirmPassword) {
            message.textContent = "New passwords do not match.";
            return;
        }

        try {
            const response = await fetch(
                "/api/admin/change-password",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                message.textContent =
                    data.message || "Failed to change password.";
                return;
            }

            alert("Password changed successfully.");

            const user =
                JSON.parse(localStorage.getItem("adminUser"));

            user.mustChangePassword = false;

            localStorage.setItem(
                "adminUser",
                JSON.stringify(user)
            );

            window.location.href = "/admin";

        } catch (error) {
            console.error(error);
            message.textContent =
                "Something went wrong.";
        }
    });