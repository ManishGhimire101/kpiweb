(function () {
  const form = document.getElementById("regForm");
  if (!form) return;

  const $ = (id) => document.getElementById(id);
  const nameInput = $("name");
  const codeInput = $("code");
  const subInput = $("subdomain");
  const subStatus = $("subStatus");
  const color = $("themeColor");
  const submit = $("regSubmit");
  const formErr = $("formErr");

  let codeTouched = false;
  let subTouched = false;
  let suffix = "." + location.host;
  let checkTimer = null;
  let suggestTimer = null;
  let checkSeq = 0;

  fetch("/api/config")
    .then((r) => r.json())
    .then((data) => {
      if (data.portalSuffix) suffix = data.portalSuffix;
      document.querySelectorAll(".addr-input .suffix").forEach((s) => (s.textContent = suffix));
    })
    .catch(() => {});

  const setError = (field, message) => {
    const el = form.querySelector(`.err[data-for="${field}"]`);
    const input = $(field);
    if (el) el.textContent = message || "";
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
  };

  const clearErrors = () => {
    form.querySelectorAll(".err").forEach((el) => (el.textContent = ""));
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    formErr.hidden = true;
  };

  const makeCode = (name) => {
    const words = name.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    const initials = words.map((w) => w[0]).join("");
    return (initials.length >= 2 ? initials : words[0].slice(0, 6)).slice(0, 20);
  };

  const setStatus = (text, state) => {
    subStatus.textContent = text;
    subStatus.dataset.state = state || "";
  };

  const checkSub = () => {
    const value = subInput.value.trim().toLowerCase();
    if (!value) {
      setStatus("Lowercase letters, numbers and hyphens.", "");
      return;
    }
    const seq = ++checkSeq;
    setStatus("Checking…", "wait");
    fetch(`/api/register/check-subdomain?value=${encodeURIComponent(value)}`)
      .then((r) => r.json())
      .then((data) => {
        if (seq !== checkSeq) return;
        if (data.available) setStatus(`${value}${suffix} is available`, "ok");
        else setStatus(data.message || "Not available", "bad");
      })
      .catch(() => {
        if (seq === checkSeq) setStatus("Could not check right now", "");
      });
  };

  const suggest = () => {
    const name = nameInput.value.trim();
    if (!name || subTouched) return;
    fetch(`/api/register/suggest-subdomain?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.value && !subTouched) {
          subInput.value = data.value;
          checkSub();
        }
      })
      .catch(() => {});
  };

  nameInput.addEventListener("input", () => {
    if (!codeTouched) codeInput.value = makeCode(nameInput.value);
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(suggest, 450);
  });

  codeInput.addEventListener("input", () => {
    codeTouched = codeInput.value.trim() !== "";
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  });

  subInput.addEventListener("input", () => {
    subTouched = subInput.value.trim() !== "";
    subInput.value = subInput.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkSub, 350);
  });

  color.addEventListener("input", () => ($("colorValue").textContent = color.value));

  form.addEventListener("input", (event) => {
    if (event.target.name) setError(event.target.name, "");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();

    const payload = Object.fromEntries(new FormData(form).entries());
    let firstBad = null;

    if (!payload.name.trim()) firstBad = firstBad || (setError("name", "School name is required"), "name");
    if (!payload.code.trim()) firstBad = firstBad || (setError("code", "School code is required"), "code");
    if (!payload.subdomain.trim()) firstBad = firstBad || (setError("subdomain", "Pick an address for the school"), "subdomain");

    if (firstBad) {
      $(firstBad).focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Registering…";

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const errors = data.errors || (data.field ? { [data.field]: data.message } : null);
        if (errors) {
          Object.entries(errors).forEach(([field, message]) => setError(field, message));
          const first = Object.keys(errors).find((f) => $(f));
          if (first) $(first).focus();
        }
        if (!errors || !Object.keys(errors).some((f) => $(f))) {
          formErr.textContent = data.message || "Something went wrong. Please try again.";
          formErr.hidden = false;
        }
        return;
      }

      showDone(data);
    } catch (error) {
      formErr.textContent = "Could not reach the server. Check your connection and try again.";
      formErr.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Register school";
    }
  });

  const showDone = (data) => {
    const portal = data.institution.portalUrl;
    const creds = data.adminCredentials || {};
    $("doneName").textContent = data.institution.name;
    $("donePortal").textContent = portal.replace(/^https?:\/\//, "");
    $("donePortal").href = portal;
    $("doneUser").textContent = creds.username || "";
    $("donePass").textContent = creds.temporaryPassword || "";
    $("doneLogin").href = `${portal}/login`;
    form.hidden = true;
    const done = $("regDone");
    done.hidden = false;
    done.focus();
    done.scrollIntoView({ block: "start" });
  };

  const copy = (text, button) => {
    const done = () => {
      const label = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = label), 1400);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(() => {});
  };

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copy($(button.dataset.copy).textContent, button));
  });

  $("copyAll").addEventListener("click", (event) => {
    copy(
      `School: ${$("doneName").textContent}\nAddress: ${$("donePortal").href}\nSign-in: ${$("doneLogin").href}\nUsername: ${$("doneUser").textContent}\nTemporary password: ${$("donePass").textContent}`,
      event.currentTarget
    );
  });
})();
