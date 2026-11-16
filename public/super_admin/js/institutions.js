let institutions = [];
let currentInstitution = null;
let institutionStatusTarget = null;
let portalSuffix = ".localhost";
let subdomainTouched = false;
let subdomainAvailable = null;
let subdomainTimer = null;
let subdomainSeq = 0;

async function loadInstitutionsPage() {

  const pageContent = document.getElementById("pageContent");

  pageContent.innerHTML = `
    <div class="page-loading">
      Loading institutions...
    </div>
  `;

  try {

    try {
      const config = await (await fetch("/api/config")).json();
      if (config.portalSuffix) portalSuffix = config.portalSuffix;
    } catch (configError) {
      console.error("Config load failed", configError);
    }

    const response = await fetch(
      "/super_admin/components/institutions.html"
    );

    if (!response.ok) {
      throw new Error("Failed to load institutions component");
    }

    pageContent.innerHTML = await response.text();

    initializeInstitutionPage();

    await fetchInstitutions();

  } catch (error) {

    console.error("Institution page error:", error);

    pageContent.innerHTML = `
      <div class="error-state">
        <h2>Unable to load institutions</h2>
        <p>Please try again.</p>
      </div>
    `;
  }
}

function initializeInstitutionPage() {

  document
    .getElementById("addInstitutionButton")
    ?.addEventListener(
      "click",
      () => openCreateInstitutionModal()
    );

  document
    .getElementById("institutionSearch")
    ?.addEventListener(
      "input",
      filterInstitutions
    );

  document
    .getElementById("institutionStatusFilter")
    ?.addEventListener(
      "change",
      filterInstitutions
    );

  document
    .getElementById("institutionForm")
    ?.addEventListener(
      "submit",
      saveInstitution
    );

  document
    .getElementById("institutionSubdomain")
    ?.addEventListener(
      "input",
      onSubdomainInput
    );

  document
    .getElementById("institutionName")
    ?.addEventListener(
      "input",
      onInstitutionNameInput
    );

  document
    .getElementById("institutionCreateAdmin")
    ?.addEventListener(
      "change",
      (event) => {
        document.getElementById("adminAccountFields").style.display =
          event.target.checked ? "" : "none";
      }
    );

  const suffixEl = document.getElementById("institutionSubdomainSuffix");
  if (suffixEl) suffixEl.textContent = portalSuffix;

  document
    .getElementById("viewEditInstitutionButton")
    ?.addEventListener(
      "click",
      () => {

        closeModal("viewInstitutionModal");

        if (currentInstitution) {
          openEditInstitutionModal(currentInstitution);
        }

      }
    );

  document
    .getElementById("confirmStatusButton")
    ?.addEventListener(
      "click",
      confirmStatusChange
    );

  document
    .querySelectorAll("[data-close-modal]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const modalId =
          button.dataset.closeModal;

        closeModal(modalId);

      });

    });

  document
    .querySelectorAll(".modal-overlay")
    .forEach(modal => {

      modal.addEventListener("click", event => {

        if (event.target === modal) {
          closeModal(modal.id);
        }

      });

    });

}

async function fetchInstitutions() {

  try {

    const token =
      localStorage.getItem("superAdminToken");

    if (!token) {
      throw new Error("Authentication token missing");
    }

    const response = await fetch(
      "/api/super-admin/institutions",
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ||
        "Failed to load institutions"
      );
    }

    institutions = result.data || result.institutions || [];

    renderInstitutions();

  } catch (error) {

    console.error(
      "Failed to fetch institutions:",
      error
    );

    const tbody =
      document.getElementById(
        "institutionsTableBody"
      );

    if (tbody) {

      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="table-error">
            Failed to load institutions.
          </td>
        </tr>
      `;

    }

  }

}

function renderInstitutions(list = institutions) {

  const tbody =
    document.getElementById(
      "institutionsTableBody"
    );

  const count =
    document.getElementById(
      "institutionCount"
    );

  if (!tbody) return;

  if (count) {
    count.textContent =
      `${list.length} institution${list.length === 1 ? "" : "s"}`;
  }

  if (list.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          No institutions found.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = list.map(institution => {

    const statusClass =
      institution.isActive
        ? "status-active"
        : "status-inactive";

    const statusText =
      institution.isActive
        ? "Active"
        : "Inactive";

    const created =
      institution.createdAt
        ? new Date(
            institution.createdAt
          ).toLocaleDateString()
        : "-";

    return `
      <tr>

        <td>
          <div class="institution-table-name">

            <div class="table-logo">
              ${
                institution.logo
                  ? `<img src="${escapeHtml(institution.logo)}" alt="">`
                  : escapeHtml(
                      String(institution.name || "")
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0].toUpperCase())
                        .join("")
                    )
              }
            </div>

            <div>
              <strong>
                ${escapeHtml(
                  institution.name
                )}
              </strong>

              <span>
                ${escapeHtml(
                  institution.type || "Institution"
                )}
              </span>
            </div>

          </div>
        </td>

        <td>
          <strong>
            ${escapeHtml(
              institution.code
            )}
          </strong>
        </td>

        <td>
          ${institution.subdomain
            ? `
              <span class="domain-text">
                ${escapeHtml(
                  institution.subdomain
                )}${portalSuffix}
              </span>
            `
            : "-"
          }
        </td>

        <td>
          ${escapeHtml(
            institution.email || "-"
          )}
        </td>

        <td>
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </td>

        <td>
          ${created}
        </td>

        <td>

          <div class="table-actions">

            <button
              type="button"
              class="action-button"
              title="View"
              onclick="viewInstitution(${institution.id})"
            >
              View
            </button>

            <button
              type="button"
              class="action-button"
              title="Edit"
              onclick="openEditInstitutionById(${institution.id})"
            >
              Edit
            </button>

            <button
              type="button"
              class="action-button ${
                institution.isActive
                  ? "action-danger"
                  : "action-success"
              }"
              onclick="openStatusModal(
                ${institution.id},
                ${institution.isActive}
              )"
            >
              ${
                institution.isActive
                  ? "Deactivate"
                  : "Activate"
              }
            </button>

          </div>

        </td>

      </tr>
    `;

  }).join("");

}

function filterInstitutions() {

  const search =
    document
      .getElementById(
        "institutionSearch"
      )
      ?.value
      .trim()
      .toLowerCase() || "";

  const status =
    document
      .getElementById(
        "institutionStatusFilter"
      )
      ?.value || "all";

  const filtered =
    institutions.filter(institution => {

      const matchesSearch =
        !search ||

        institution.name
          ?.toLowerCase()
          .includes(search) ||

        institution.code
          ?.toLowerCase()
          .includes(search) ||

        institution.email
          ?.toLowerCase()
          .includes(search) ||

        institution.subdomain
          ?.toLowerCase()
          .includes(search);

      const matchesStatus =
        status === "all" ||

        (status === "active" &&
          institution.isActive) ||

        (status === "inactive" &&
          !institution.isActive);

      return matchesSearch && matchesStatus;

    });

  renderInstitutions(filtered);
}

async function viewInstitution(id) {

  try {

    const institution =
      institutions.find(
        item => item.id === id
      );

    if (!institution) {
      throw new Error(
        "Institution not found"
      );
    }

    currentInstitution = institution;

    document.getElementById(
      "viewInstitutionName"
    ).textContent =
      institution.name || "-";

    document.getElementById(
      "viewInstitutionCode"
    ).textContent =
      institution.code || "-";

    document.getElementById(
      "viewInstitutionType"
    ).textContent =
      institution.type || "-";

    document.getElementById(
      "viewInstitutionEmail"
    ).textContent =
      institution.email || "-";

    document.getElementById(
      "viewInstitutionPhone"
    ).textContent =
      institution.phone || "-";

    document.getElementById(
      "viewInstitutionStatus"
    ).textContent =
      institution.isActive
        ? "Active"
        : "Inactive";

    document.getElementById(
      "viewInstitutionSubdomain"
    ).textContent =
      institution.subdomain
        ? `${institution.subdomain}${portalSuffix}`
        : "-";

    document.getElementById(
      "viewInstitutionDomain"
    ).textContent =
      institution.customDomain || "-";

    document.getElementById(
      "viewInstitutionAddress"
    ).textContent =
      institution.address || "-";

    document.getElementById(
      "viewInstitutionWebsite"
    ).textContent =
      institution.website || "-";

    document.getElementById(
      "viewInstitutionCreated"
    ).textContent =
      formatDate(institution.createdAt);

    document.getElementById(
      "viewInstitutionUpdated"
    ).textContent =
      formatDate(institution.updatedAt);

    openModal(
      "viewInstitutionModal"
    );

  } catch (error) {

    console.error(error);

    alert(
      "Unable to load institution details."
    );

  }

}

function openCreateInstitutionModal() {

  const form =
    document.getElementById(
      "institutionForm"
    );

  form.reset();

  subdomainTouched = false;
  subdomainAvailable = null;
  setSubdomainStatus("", "");
  updateDomainPreview();

  document.getElementById("adminAccountSection").style.display = "";
  document.getElementById("adminAccountFields").style.display = "";

  document.getElementById(
    "institutionId"
  ).value = "";

  document.getElementById(
    "institutionFormTitle"
  ).textContent =
    "Create Institution";

  document.getElementById(
    "institutionFormSubtitle"
  ).textContent =
    "Add a new institution to MYIMS.";

  document.getElementById(
    "institutionActive"
  ).checked = true;

  document.getElementById(
    "institutionThemeColor"
  ).value =
    "#2563eb";

  document.getElementById(
    "saveInstitutionButton"
  ).textContent =
    "Create Institution";

  clearFormMessage();

  openModal(
    "institutionFormModal"
  );

}

function openEditInstitutionById(id) {

  const institution =
    institutions.find(
      item => item.id === id
    );

  if (!institution) {
    alert("Institution not found.");
    return;
  }

  openEditInstitutionModal(
    institution
  );

}

function openEditInstitutionModal(institution) {

  currentInstitution =
    institution;

  subdomainTouched = true;
  subdomainAvailable = true;
  setSubdomainStatus("", "");
  document.getElementById("adminAccountSection").style.display = "none";

  document.getElementById(
    "institutionId"
  ).value =
    institution.id;

  document.getElementById(
    "institutionName"
  ).value =
    institution.name || "";

  document.getElementById(
    "institutionCode"
  ).value =
    institution.code || "";

  document.getElementById(
    "institutionType"
  ).value =
    institution.type || "";

  document.getElementById(
    "institutionEmail"
  ).value =
    institution.email || "";

  document.getElementById(
    "institutionPhone"
  ).value =
    institution.phone || "";

  document.getElementById(
    "institutionAddress"
  ).value =
    institution.address || "";

  document.getElementById(
    "institutionSubdomain"
  ).value =
    institution.subdomain || "";

  document.getElementById(
    "institutionCustomDomain"
  ).value =
    institution.customDomain || "";

  document.getElementById(
    "institutionThemeColor"
  ).value =
    institution.themeColor || "#2563eb";

  document.getElementById(
    "institutionActive"
  ).checked =
    institution.isActive;

  updateDomainPreview();

  document.getElementById(
    "institutionFormTitle"
  ).textContent =
    "Edit Institution";

  document.getElementById(
    "institutionFormSubtitle"
  ).textContent =
    "Update institution information.";

  document.getElementById(
    "saveInstitutionButton"
  ).textContent =
    "Save Changes";

  clearFormMessage();

  openModal(
    "institutionFormModal"
  );

}

async function saveInstitution(event) {

  event.preventDefault();

  const id =
    document.getElementById(
      "institutionId"
    ).value;

  const isEdit =
    Boolean(id);

  const data = {

    name:
      document.getElementById(
        "institutionName"
      ).value.trim(),

    code:
      document.getElementById(
        "institutionCode"
      ).value.trim(),

    type:
      document.getElementById(
        "institutionType"
      ).value.trim(),

    email:
      document.getElementById(
        "institutionEmail"
      ).value.trim(),

    phone:
      document.getElementById(
        "institutionPhone"
      ).value.trim(),

    address:
      document.getElementById(
        "institutionAddress"
      ).value.trim(),

    website:
      document.getElementById(
        "institutionWebsite"
      )?.value.trim() || "",

    subdomain:
      document.getElementById(
        "institutionSubdomain"
      ).value.trim(),

    customDomain:
      document.getElementById(
        "institutionCustomDomain"
      ).value.trim(),

    themeColor:
      document.getElementById(
        "institutionThemeColor"
      ).value,

    isActive:
      document.getElementById(
        "institutionActive"
      ).checked

  };

  if (!data.name ||
      !data.code ||
      !data.subdomain) {

    showFormMessage(
      "Please fill all required fields.",
      "error"
    );

    return;
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(data.code)) {
    showFormMessage(
      "Code must be 2-20 characters: letters, numbers and hyphens.",
      "error"
    );
    return;
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    showFormMessage("Enter a valid institution email address.", "error");
    return;
  }

  clearTimeout(subdomainTimer);
  await runSubdomainCheck();

  if (subdomainAvailable !== true) {
    showFormMessage("Choose an available subdomain before saving.", "error");
    document.getElementById("institutionSubdomain").focus();
    return;
  }

  if (!isEdit) {
    data.createAdmin = document.getElementById("institutionCreateAdmin").checked;
    data.adminName = document.getElementById("institutionAdminName").value.trim();
    data.adminEmail = document.getElementById("institutionAdminEmail").value.trim();
  }

  const button =
    document.getElementById(
      "saveInstitutionButton"
    );

  button.disabled = true;

  button.textContent =
    isEdit
      ? "Saving..."
      : "Creating...";

  try {

    const token =
      localStorage.getItem(
        "superAdminToken"
      );

    const url =
      isEdit
        ? `/api/super-admin/institutions/${id}`
        : "/api/super-admin/institutions";

    const method =
      isEdit
        ? "PUT"
        : "POST";

    const response =
      await fetch(url, {

        method,

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`
        },

        body:
          JSON.stringify(data)

      });

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ||
        "Failed to save institution"
      );
    }

    const logoFile = document.getElementById("institutionLogo")?.files?.[0];

    if (logoFile) {

      const savedId = isEdit ? id : result.institution.id;
      const logoData = new FormData();
      logoData.append("logo", logoFile);

      const logoResponse = await fetch(
        `/api/super-admin/institutions/${savedId}/logo`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: logoData
        }
      );

      if (!logoResponse.ok) {
        const logoResult = await logoResponse.json().catch(() => ({}));
        throw new Error(
          `Institution saved, but the logo failed: ${logoResult.message || "upload error"}`
        );
      }

    }

    showFormMessage(
      isEdit
        ? "Institution updated successfully."
        : "Institution created successfully.",
      "success"
    );

    if (!isEdit) {
      showCreatedInstitution(result);
    }

    await fetchInstitutions();

    setTimeout(() => {

      closeModal(
        "institutionFormModal"
      );

    }, 600);

  } catch (error) {

    console.error(error);

    showFormMessage(
      error.message ||
      "Something went wrong.",
      "error"
    );

  } finally {

    button.disabled = false;

    button.textContent =
      isEdit
        ? "Save Changes"
        : "Create Institution";

  }

}

function openStatusModal(id, currentlyActive) {

  const institution =
    institutions.find(
      item => item.id === id
    );

  if (!institution) return;

  institutionStatusTarget = {
    id,
    newStatus: !currentlyActive
  };

  document.getElementById(
    "statusModalTitle"
  ).textContent =
    currentlyActive
      ? "Deactivate Institution"
      : "Activate Institution";

  document.getElementById(
    "statusModalMessage"
  ).textContent =
    currentlyActive
      ? `Are you sure you want to deactivate ${institution.name}?`
      : `Are you sure you want to activate ${institution.name}?`;

  document.getElementById(
    "confirmStatusButton"
  ).textContent =
    currentlyActive
      ? "Deactivate"
      : "Activate";

  openModal(
    "statusModal"
  );

}

async function confirmStatusChange() {

  if (!institutionStatusTarget) {
    return;
  }

  const {
    id,
    newStatus
  } = institutionStatusTarget;

  const button =
    document.getElementById(
      "confirmStatusButton"
    );

  button.disabled = true;

  button.textContent =
    "Updating...";

  try {

    const token =
      localStorage.getItem(
        "superAdminToken"
      );

    const response =
      await fetch(
        `/api/super-admin/institutions/${id}/status`,
        {

          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`
          },

          body:
            JSON.stringify({
              isActive: newStatus
            })

        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ||
        "Failed to update status"
      );
    }

    closeModal(
      "statusModal"
    );

    await fetchInstitutions();

  } catch (error) {

    console.error(error);

    alert(
      error.message ||
      "Failed to update status."
    );

  } finally {

    button.disabled = false;

    institutionStatusTarget =
      null;

  }

}

function setSubdomainStatus(message, kind) {

  const el = document.getElementById("institutionSubdomainStatus");

  if (!el) return;

  el.textContent = message;
  el.style.color = kind === "ok" ? "#15803d" : kind === "error" ? "#b91c1c" : "#6b7280";

}

async function runSubdomainCheck() {

  const input = document.getElementById("institutionSubdomain");

  if (!input) return;

  const value = input.value.trim().toLowerCase();
  const seq = ++subdomainSeq;

  if (!value) {
    subdomainAvailable = null;
    setSubdomainStatus("", "");
    return;
  }

  setSubdomainStatus("Checking availability...", "");

  const excludeId = document.getElementById("institutionId").value;

  try {

    const response = await fetch(
      `/api/super-admin/institutions/check-subdomain?value=${encodeURIComponent(value)}${excludeId ? `&excludeId=${excludeId}` : ""}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem("superAdminToken")}` } }
    );

    const result = await response.json();

    if (seq !== subdomainSeq) return;

    if (!response.ok) {
      throw new Error(result.message || "Check failed");
    }

    subdomainAvailable = result.available;
    setSubdomainStatus(
      result.available ? `Available - ${result.url}` : result.message,
      result.available ? "ok" : "error"
    );

  } catch (error) {

    if (seq !== subdomainSeq) return;

    subdomainAvailable = null;
    setSubdomainStatus("Could not check availability", "error");

  }

}

function onSubdomainInput(event) {

  const input = event.target;
  const cleaned = input.value.toLowerCase().replace(/[^a-z0-9-]/g, "");

  if (cleaned !== input.value) {
    input.value = cleaned;
  }

  if (event.isTrusted) {
    subdomainTouched = true;
  }

  updateDomainPreview();
  subdomainAvailable = null;

  clearTimeout(subdomainTimer);
  subdomainTimer = setTimeout(runSubdomainCheck, 350);

}

let suggestTimer = null;

function onInstitutionNameInput(event) {

  if (document.getElementById("institutionId").value || subdomainTouched) return;

  const name = event.target.value.trim();

  clearTimeout(suggestTimer);

  if (!name) {
    document.getElementById("institutionSubdomain").value = "";
    updateDomainPreview();
    setSubdomainStatus("", "");
    return;
  }

  suggestTimer = setTimeout(async () => {

    try {

      const response = await fetch(
        `/api/super-admin/institutions/suggest-subdomain?name=${encodeURIComponent(name)}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("superAdminToken")}` } }
      );

      const result = await response.json();

      if (!response.ok || subdomainTouched) return;

      const input = document.getElementById("institutionSubdomain");
      input.value = result.value;
      updateDomainPreview();
      runSubdomainCheck();

    } catch (error) {
      console.error("Suggest subdomain failed", error);
    }

  }, 300);

}

function showCreatedInstitution(result) {

  const url = result.institution.portalUrl;
  const creds = result.adminCredentials;

  const overlay = document.createElement("div");

  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px";

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;max-width:520px;width:100%;padding:24px">
      <h2 style="margin-bottom:8px">Institution created</h2>
      <p style="margin-bottom:10px">${escapeHtml(result.institution.name)} is live at:</p>
      <p style="margin-bottom:12px"><strong>${escapeHtml(url)}</strong></p>
      ${creds ? `
        <p style="font-size:14px;color:#6b7280;margin-bottom:6px">Admin login (shown only once - the admin must change the password on first sign-in):</p>
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;font-family:ui-monospace,Menlo,monospace;word-break:break-all">
          Username: ${escapeHtml(creds.username)}<br>
          Temporary password: ${escapeHtml(creds.temporaryPassword)}
        </div>` : ""}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        ${creds ? '<button type="button" data-copy style="padding:8px 14px;border:1px solid #111827;background:#fff;color:#111827;border-radius:8px;cursor:pointer">Copy</button>' : ""}
        <button type="button" data-done style="padding:8px 14px;border:0;background:#111827;color:#fff;border-radius:8px;cursor:pointer">Done</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector("[data-done]").addEventListener("click", () => overlay.remove());

  const copy = overlay.querySelector("[data-copy]");

  if (copy) {
    copy.addEventListener("click", () => {
      navigator.clipboard.writeText(
        `Portal: ${url}\nUsername: ${creds.username}\nPassword: ${creds.temporaryPassword}`
      );
      copy.textContent = "Copied";
    });
  }

}

function updateDomainPreview() {

  const subdomain =
    document
      .getElementById(
        "institutionSubdomain"
      )
      ?.value
      .trim()
      .toLowerCase();

  const preview =
    document.getElementById(
      "institutionDomainPreview"
    );

  if (!preview) return;

  preview.textContent =
    subdomain
      ? `${subdomain}${portalSuffix}`
      : `yourcollege${portalSuffix}`;

}

function openModal(modalId) {
    const modal = document.getElementById(modalId);

    if (!modal) {
        console.error(`Modal not found: ${modalId}`);
        return;
    }

    modal.style.display = "flex";
    modal.classList.add("active");
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);

    if (!modal) {
        console.error(`Modal not found: ${modalId}`);
        return;
    }

    modal.style.display = "none";
    modal.classList.remove("active");
}

function showFormMessage(
  message,
  type
) {

  const element =
    document.getElementById(
      "institutionFormMessage"
    );

  if (!element) return;

  element.textContent =
    message;

  element.className =
    `form-message ${type}`;

}

function clearFormMessage() {

  const element =
    document.getElementById(
      "institutionFormMessage"
    );

  if (!element) return;

  element.textContent = "";

  element.className =
    "form-message";

}

function formatDate(date) {

  if (!date) return "-";

  return new Date(date)
    .toLocaleString();

}

function escapeHtml(value) {

  if (value === null ||
      value === undefined) {

    return "";

  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}