(async function () {
  const $ = (id) => document.getElementById(id);
  const form = $("pwForm");
  const error = $("pwError");
  const success = $("pwSuccess");
  const submit = $("pwSubmit");
  const current = $("currentPassword");
  const next = $("newPassword");
  const confirm = $("confirmPassword");

  const token = Portal.token() || localStorage.getItem("adminToken");

  if (!token) {
    window.location.replace("/login");
    return;
  }

  if (!Portal.token()) localStorage.setItem("portalToken", token);

  const showError = (message) => {
    error.textContent = message;
    error.hidden = false;
  };

  $("pwSignOut").addEventListener("click", Portal.logout);

  let user;

  try {
    user = (await Portal.api("/api/auth/me")).user;
    Portal.save(Portal.token(), user);
  } catch (err) {
    Portal.logout();
    return;
  }

  const home = Portal.homeFor(user.role);
  const forced = Boolean(user.mustChangePassword);

  if (user.institution) {
    $("pwSchool").textContent = user.institution.name;
    document.title = `Change password - ${user.institution.name}`;
    if (user.institution.themeColor) {
      document.documentElement.style.setProperty("--brand", user.institution.themeColor);
    }
  }

  if (forced) {
    $("pwTitle").textContent = "Set your password";
    $("pwSub").textContent = `Signed in as ${user.username}.`;
    $("currentLabel").textContent = "Temporary password";
    $("pwForced").hidden = false;
  } else {
    const back = $("pwBack");
    back.href = home;
    back.textContent = "← Back to dashboard";
    back.hidden = false;
  }

  form.hidden = false;
  current.focus();

  const rules = {
    length: () => next.value.length >= 8,
    different: () => next.value.length > 0 && next.value !== current.value,
  };

  const paintRules = () => {
    Object.entries(rules).forEach(([name, test]) => {
      const li = form.querySelector(`[data-rule="${name}"]`);
      li.classList.toggle("ok", test());
    });
  };

  [current, next].forEach((input) => input.addEventListener("input", paintRules));
  form.addEventListener("input", () => (error.hidden = true));

  form.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.toggle);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Hide" : "Show";
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.hidden = true;

    if (!current.value) {
      showError(forced ? "Enter the temporary password you signed in with." : "Enter your current password.");
      current.focus();
      return;
    }

    if (!rules.length()) {
      showError("New password must be at least 8 characters long.");
      next.focus();
      return;
    }

    if (!rules.different()) {
      showError("New password must be different from the current password.");
      next.focus();
      return;
    }

    if (next.value !== confirm.value) {
      showError("New passwords do not match.");
      confirm.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Updating...";

    try {
      await Portal.api("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: current.value, newPassword: next.value },
        noRedirect: true,
      });

      user.mustChangePassword = false;
      Portal.save(Portal.token(), user);

      form.hidden = true;
      $("pwForced").hidden = true;
      success.textContent = "Password updated. Taking you to your dashboard...";
      success.hidden = false;
      setTimeout(() => window.location.replace(home), 1200);
    } catch (err) {
      showError(err.message);
      submit.disabled = false;
      submit.textContent = "Update password";
    }
  });
})();
