(async function () {
  const form = document.getElementById("loginForm");
  const error = document.getElementById("error");
  const button = document.getElementById("submitBtn");

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }

  const existing = Portal.user();

  if (Portal.token() && existing) {
    try {
      const me = await Portal.api("/api/auth/me", { noRedirect: true });
      window.location.href = me.user.mustChangePassword ? "/change-password" : Portal.homeFor(existing.role);
      return;
    } catch (err) {
      Portal.clear();
    }
  }

  try {
    const config = await (await fetch("/api/config")).json();

    if (config.institution) {
      document.title = `Sign in - ${config.institution.name}`;
      document.getElementById("instName").textContent = config.institution.name;
      document.documentElement.style.setProperty("--brand", config.institution.themeColor);
      form.hidden = false;
    } else if (config.institutionError === "inactive") {
      showError("This institution is currently inactive. Please contact the administrator.");
    } else {
      showError("This portal address does not exist.");
    }
  } catch (err) {
    showError("Unable to load the portal. Please try again.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.hidden = true;
    button.disabled = true;
    button.textContent = "Signing in...";

    try {
      const data = await Portal.api("/api/auth/login", {
        method: "POST",
        body: {
          username: form.username.value.trim(),
          password: form.password.value,
        },
        noRedirect: true,
      });

      Portal.save(data.token, data.user);
      window.location.href = data.user.mustChangePassword ? "/change-password" : Portal.homeFor(data.user.role);
    } catch (err) {
      showError(err.message);
      button.disabled = false;
      button.textContent = "Sign in";
    }
  });
})();
