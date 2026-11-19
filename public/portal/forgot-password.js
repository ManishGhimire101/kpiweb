(async function () {
  const form = document.getElementById("forgotForm");
  const error = document.getElementById("error");
  const button = document.getElementById("submitBtn");

  function showMessage(message, isError = true) {
    error.textContent = message;
    error.hidden = false;
    error.style.background = isError ? "var(--bad-bg)" : "var(--ok-bg)";
    error.style.color = isError ? "var(--bad)" : "var(--ok)";
  }

  try {
    const config = await (await fetch("/api/config")).json();

    if (config.institution) {
      document.title = `Forgot Password - ${config.institution.name}`;
      document.documentElement.style.setProperty("--brand", config.institution.themeColor);
    } else {
      showMessage("This password reset page is unavailable for this address.");
      button.disabled = true;
    }
  } catch (err) {
    showMessage("Unable to load the portal. Please try again.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.hidden = true;

    const username = form.username.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    if (newPassword.length < 8) {
      showMessage("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("Password confirmation does not match.");
      return;
    }

    button.disabled = true;
    button.textContent = "Resetting...";

    try {
      const data = await Portal.api("/api/auth/forgot-password", {
        method: "POST",
        body: { username, email, newPassword },
        noRedirect: true,
      });

      Portal.clear();
      showMessage(data.message || "Password reset successfully. Redirecting to sign in...", false);
      form.reset();

      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (err) {
      showMessage(err.message);
    } finally {
      button.disabled = false;
      button.textContent = "Reset password";
    }
  });
})();
