let institutions = [];
let currentInstitution = null;
let institutionStatusTarget = null;


// ==========================================
// LOAD INSTITUTIONS COMPONENT
// ==========================================

async function loadInstitutionsPage() {

  const pageContent = document.getElementById("pageContent");

  pageContent.innerHTML = `
    <div class="page-loading">
      Loading institutions...
    </div>
  `;

  try {

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


// ==========================================
// INITIALIZE
// ==========================================

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
      updateDomainPreview
    );


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


  // Close modal buttons

  document
    .querySelectorAll("[data-close-modal]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const modalId =
          button.dataset.closeModal;

        closeModal(modalId);

      });

    });


  // Close when clicking overlay

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


// ==========================================
// FETCH
// ==========================================

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


// ==========================================
// RENDER
// ==========================================

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
              🏫
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
                )}.myims.com
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


// ==========================================
// SEARCH / FILTER
// ==========================================

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


// ==========================================
// VIEW
// ==========================================

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
        ? `${institution.subdomain}.myims.com`
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


// ==========================================
// CREATE
// ==========================================

function openCreateInstitutionModal() {

  const form =
    document.getElementById(
      "institutionForm"
    );

  form.reset();


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


// ==========================================
// EDIT
// ==========================================

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


// ==========================================
// SAVE
// ==========================================

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


    showFormMessage(
      isEdit
        ? "Institution updated successfully."
        : "Institution created successfully.",
      "success"
    );


    // Refresh list without page reload

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


// ==========================================
// STATUS
// ==========================================

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


// ==========================================
// DOMAIN PREVIEW
// ==========================================

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
      ? `${subdomain}.myims.com`
      : "yourcollege.myims.com";

}


// ==========================================
// MODALS
// ==========================================

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


// ==========================================
// FORM MESSAGE
// ==========================================

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


// ==========================================
// HELPERS
// ==========================================

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