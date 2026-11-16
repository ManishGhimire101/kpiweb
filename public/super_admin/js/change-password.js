(async function () {
  const TOKEN_KEY = "superAdminToken";
  const USER_KEY = "superAdminUser";
  const $ = (id) => document.getElementById(id);

  const form = $("form");
  const message = $("message");
  const submit = $("submit");
  const current = $("currentPassword");
  const next = $("newPassword");
  const confirm = $("confirmPassword");

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.replace("/superadmin");
  };

  const show = (text, type) => {
    message.textContent = text;
    message.className = `message ${type}`;
  };

  $("signOut").addEventListener("click", signOut);

  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    signOut();
    return;
  }

  let user;

  try {
    const response = await fetch("/api/super-admin/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      signOut();
      return;
    }

    user = (await response.json()).user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    show("Unable to connect to the server.", "error");
    return;
  }

  const forced = Boolean(user.mustChangePassword);

  $("subtitle").textContent = `Signed in as ${user.username}`;

  if (forced) {
    $("title").textContent = "Set a new password";
    $("forcedNotice").hidden = false;
  } else {
    $("back").hidden = false;
  }

  form.hidden = false;
  current.focus();

  const rules = {
    length: () => next.value.length >= 12,
    mix: () => /[A-Za-z]/.test(next.value) && /[0-9]/.test(next.value),
    username: () => next.value.length > 0 && !next.value.toLowerCase().includes(user.username.toLowerCase()),
    different: () => next.value.length > 0 && next.value !== current.value,
  };

  const paint = () => {
    Object.entries(rules).forEach(([name, test]) => {
      form.querySelector(`[data-rule="${name}"]`).classList.toggle("ok", test());
    });
  };

  [current, next].forEach((input) => input.addEventListener("input", paint));

  form.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.toggle);
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.textContent = reveal ? "Hide" : "Show";
      button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.className = "message";

    if (!current.value) {
      show("Enter your current password.", "error");
      current.focus();
      return;
    }

    const failed = Object.entries(rules).find(([, test]) => !test());

    if (failed) {
      show(`New password: ${form.querySelector(`[data-rule="${failed[0]}"]`).textContent.toLowerCase()}.`, "error");
      next.focus();
      return;
    }

    if (next.value !== confirm.value) {
      show("New passwords do not match.", "error");
      confirm.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Updating...";

    try {
      const response = await fetch("/api/super-admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
        },
        body: JSON.stringify({ currentPassword: current.value, newPassword: next.value }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        signOut();
        return;
      }

      if (!response.ok || !data.success) {
        show(data.message || "Failed to change password.", "error");
        if (data.field && $(data.field)) $(data.field).focus();
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      form.hidden = true;
      $("forcedNotice").hidden = true;
      show("Password updated. Other sessions have been signed out.", "success");
      setTimeout(() => window.location.replace("/super_admin"), 1200);
    } catch (error) {
      show("Unable to connect to the server.", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Update password";
    }
  });
})();
