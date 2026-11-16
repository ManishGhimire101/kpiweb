let selectedUserId = null;
let selectedUserNewStatus = null;
let resetPasswordUserId = null;

// ==========================================
// USERS PAGE
// ==========================================

let users = [];
let institutaion = [];

// ==========================================
// LOAD USERS PAGE
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

function getToken() {
  return localStorage.getItem("superAdminToken");
}

async function loadUsersPage() {
  const pageContent = document.getElementById("pageContent");

  try {
    // Load users component

    const response = await fetch("/super_admin/components/users.html");

    if (!response.ok) {
      throw new Error("Failed to load users component");
    }

    const html = await response.text();

    pageContent.innerHTML = html;

    //fetch institutaions
    await loadInstitutions();
    // Initialize page

    initializeUsersPage();

    // Fetch users from API

    await fetchUsers();
  } catch (error) {
    console.error("Failed to load users page:", error);

    pageContent.innerHTML = `
      <div class="empty-state">
        <h2>Failed to load Users</h2>
        <p>
          Something went wrong while loading the users page.
        </p>
      </div>
    `;
  }
}

//open reset password module
function openResetPasswordModal(id, username) {
  resetPasswordUserId = id;

  const usernameElement = document.getElementById("resetPasswordUsername");

  const passwordInput = document.getElementById("resetPasswordInput");

  if (usernameElement) {
    usernameElement.textContent = username;
  }

  if (passwordInput) {
    passwordInput.value = "";
  }

  openModal("resetPasswordModal");
}

//reset user password
async function resetUserPassword() {
  if (!resetPasswordUserId) {
    return;
  }

  const passwordInput = document.getElementById("resetPasswordInput");

  const password = passwordInput?.value || "";

  if (password.length < 8) {
    alert("Password must be at least 8 characters.");
    return;
  }

  try {
    const result = await usersApi(
      `/api/super-admin/users/${resetPasswordUserId}/reset-password`,
      {
        method: "POST",
        body: JSON.stringify({
          password,
        }),
      },
    );

    alert(result.message || "Password reset successfully");

    closeModal("resetPasswordModal");

    resetPasswordUserId = null;
  } catch (error) {
    console.error("Reset password error:", error);

    alert(error.message);
  }
}
//form submit handelar
async function handleUserFormSubmit(event) {
  event.preventDefault();

  const userId = document.getElementById("userId").value;

  const username = document.getElementById("userUsername").value.trim();
  const email = document.getElementById("userEmail").value.trim();
  const role = document.getElementById("userRole").value;
  const institutionId = document.getElementById("userInstitution").value;
  const password = document.getElementById("userPassword").value;
  const isActive = document.getElementById("userIsActive").checked;

  const message = document.getElementById("userFormMessage");

  try {
    message.textContent = "Saving...";

    let url;
    let method;
    let body;

    // CREATE
    if (!userId) {
      url = "/api/super-admin/users";
      method = "POST";

      body = {
        username,
        email: email || null,
        password,
        role,
        institutionId: institutionId ? Number(institutionId) : null,
        isActive,
      };
    }

    // EDIT
    else {
      url = `/api/super-admin/users/${userId}`;
      method = "PUT";

      body = {
        username,
        email: email || null,
        role,
        institutionId: institutionId ? Number(institutionId) : null,
        isActive,
      };
    }

    const result = await usersApi(url, {
      method,
      body: JSON.stringify(body),
    });

    message.textContent = result.message || "Saved successfully";

    setTimeout(async () => {
      closeModal("userFormModal");
      await fetchUsers();
    }, 500);
  } catch (error) {
    console.error(error);
    message.textContent = error.message;
  }
}
//open user satatus model
function openUserStatusModal(id, currentlyActive) {
  console.log("Status button clicked:", id, currentlyActive);

  selectedUserId = Number(id);
  selectedUserNewStatus = !currentlyActive;

  const message = document.getElementById("userStatusMessage");

  if (message) {
    message.textContent = selectedUserNewStatus
      ? "Are you sure you want to activate this user?"
      : "Are you sure you want to deactivate this user?";
  }

  const title = document.getElementById("userStatusTitle");

  if (title) {
    title.textContent = selectedUserNewStatus
      ? "Activate User"
      : "Deactivate User";
  }

  openModal("userStatusModal");
}
// ==========================================
// INITIALIZE USERS PAGE
// ==========================================

async function initializeUsersPage() {
  const searchInput = document.getElementById("userSearch");

  const roleFilter = document.getElementById("userRoleFilter");

  const statusFilter = document.getElementById("userStatusFilter");

  const institutionFilter = document.getElementById("institutionFilter");

  if (searchInput) {
    searchInput.addEventListener("input", filterUsers);
  }

  if (roleFilter) {
    roleFilter.addEventListener("change", filterUsers);
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", filterUsers);
  }

  if (institutionFilter) {
    institutionFilter.addEventListener("change", filterUsers);
  }

  const addUserButton = document.getElementById("addUserButton");

  if (addUserButton) {
    addUserButton.addEventListener("click", function () {
      console.log("Add User clicked");

      openCreateUserModal();
    });
  } else {
    console.error("addUserButton not found");
  }

  const userForm = document.getElementById("userForm");

  if (userForm) {
    userForm.addEventListener("submit", handleUserFormSubmit);
  }

  const editFromViewButton = document.getElementById("editUserFromViewButton");

  if (editFromViewButton) {
    editFromViewButton.addEventListener("click", () => {
      const userId = editFromViewButton.dataset.userId;

      closeModal("viewUserModal");

      if (userId) {
        editUser(userId);
      }
    });
  }
  //confirmation button
  const confirmStatusButton = document.getElementById(
    "confirmUserStatusButton",
  );

  if (confirmStatusButton) {
    confirmStatusButton.addEventListener("click", async function () {
      console.log("Confirm status clicked");

      await changeUserStatus();
    });
  } else {
    console.error("confirmUserStatusButton not found");
  }
  const resetPasswordButton = document.getElementById(
    "confirmResetPasswordButton",
  );

  if (resetPasswordButton) {
    resetPasswordButton.addEventListener("click", resetUserPassword);
  }
  //for close buttton selector
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.dataset.closeModal;

      closeModal(modalId);
    });
  });
  await loadInstitutions();
}
//changeuser satatus function
async function changeUserStatus() {
  if (!selectedUserId) {
    console.error("No user selected for status change");
    return;
  }

  try {
    console.log("Changing user status:", selectedUserId, selectedUserNewStatus);

    const result = await usersApi(
      `/api/super-admin/users/${selectedUserId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          isActive: selectedUserNewStatus,
        }),
      },
    );

    console.log("Status API response:", result);

    closeModal("userStatusModal");

    await fetchUsers();

    selectedUserId = null;
    selectedUserNewStatus = null;
  } catch (error) {
    console.error("Status update error:", error);

    alert(error.message);
  }
  //
}

//generic api helper
async function usersApi(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

//create user
function openCreateUserModal() {
  const form = document.getElementById("userForm");

  if (form) {
    form.reset();
  }

  document.getElementById("userId").value = "";
  document.getElementById("userFormMessage").textContent = "";

  const title = document.getElementById("userFormTitle");
  if (title) {
    title.textContent = "Create User";
  }

  openModal("userFormModal");
  //load instituation
  loadInstitutions()
  populateInstitutionDropdown();
}
//fetch institutaions
async function loadInstitutions() {
  const token = localStorage.getItem("superAdminToken");

  const response = await fetch("/api/super-admin/institutions", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to load institutions");
  }

  institutions = result.data;

  populateInstitutionDropdown();
  populateInstitutionFilter();
}
function populateInstitutionDropdown() {
  const select = document.getElementById("userInstitution");

  if (!select) return;

  select.innerHTML = `
        <option value="">Select Institution</option>
    `;

  institutions.forEach((institution) => {
    select.innerHTML += `
            <option value="${institution.id}">
                ${institution.name} (${institution.code})
            </option>
        `;
  });
}
function populateInstitutionFilter() {
  const select = document.getElementById("institutionFilter");

  if (!select) return;

  select.innerHTML = `
        <option value="">All Institutions</option>
    `;

  institutions.forEach((institution) => {
    select.innerHTML += `
            <option value="${institution.id}">
                ${institution.name}
            </option>
        `;
  });
}
// ==========================================
// FETCH USERS
// ==========================================

async function fetchUsers() {
  try {
    if (!getToken()) {
      window.location.href = "/superadmin";

      return;
    }

    const response = await fetch("/api/super-admin/users", {
      method: "GET",

      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to fetch users");
    }

    users = result.data || result.users || [];
    

    console.log("Users fetched:", users);

    renderUsers();
  } catch (error) {
    console.error("Failed to fetch users:", error);

    const tbody = document.getElementById("usersTableBody");

    if (tbody) {
      tbody.innerHTML = `

        <tr>

          <td
            colspan="7"
            class="table-error"
          >
            Failed to load users.
          </td>

        </tr>

      `;
    }
  }
}

// ==========================================
// RENDER USERS
// ==========================================

function renderUsers() {
  const tbody = document.getElementById("usersTableBody");
  const emptyState = document.getElementById("usersEmptyState");

  if (!tbody) {
    console.error("usersTableBody not found");
    return;
  }

  const searchInput = document.getElementById("userSearch");
  const roleFilter = document.getElementById("userRoleFilter");
  const statusFilter = document.getElementById("userStatusFilter");
  const institutionFilter = document.getElementById("institutionFilter");

  const search = searchInput?.value.trim().toLowerCase() || "";

  const role = roleFilter?.value || "";
  const status = statusFilter?.value || "";
  const institutionId = institutionFilter?.value || "";

  const filteredUsers = users.filter((user) => {
    const matchesInstitution =
      !institutionId || String(user.institution?.id) === String(institutionId);

    const matchesSearch =
      !search ||
      user.username?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search);

    const matchesRole = !role || user.role === role;

    const matchesStatus =
      !status ||
      (status === "active" && user.isActive === true) ||
      (status === "inactive" && user.isActive === false);

    return matchesSearch && matchesRole && matchesStatus&& matchesInstitution;
  });

  if (filteredUsers.length === 0) {
    tbody.innerHTML = "";

    if (emptyState) {
      emptyState.style.display = "block";
    }

    return;
  }

  if (emptyState) {
    emptyState.style.display = "none";
  }

  tbody.innerHTML = filteredUsers
    .map((user) => {
      const institutionName = user.institution?.name || "—";

      const statusClass = user.isActive ? "status-active" : "status-inactive";

      const statusText = user.isActive ? "Active" : "Inactive";

      const lastLogin = user.lastLoginAt
        ? formatUserDate(user.lastLoginAt)
        : "Never";

      const escapedUsername = escapeUserHtml(user.username);

      return `
      <tr>

        <!-- USER -->
        <td>
          <div class="user-table-info">

            <div class="user-table-avatar">
              ${getUserInitials(user.username)}
            </div>

            <div>
              <strong>
                ${escapedUsername}
              </strong>
            </div>

          </div>
        </td>

        <!-- EMAIL -->
        <td>
          ${user.email ? escapeUserHtml(user.email) : "—"}
        </td>

        <!-- ROLE -->
        <td>
          <span class="role-badge">
            ${formatUserRole(user.role)}
          </span>
        </td>

        <!-- INSTITUTION -->
        <td>
          ${escapeUserHtml(institutionName)}
        </td>

        <!-- STATUS -->
        <td>
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </td>

        <!-- LAST LOGIN -->
        <td>
          ${lastLogin}
        </td>

        <!-- ACTIONS -->
        <td>
          <div class="table-actions">

            <button
              type="button"
              class="action-button"
              onclick="viewUser(${user.id})">
              View
            </button>

            <button
              type="button"
              class="action-button"
              onclick="editUser(${user.id})">
              Edit
            </button>

            <button 
  type="button" 
  class="action-button ${user.isActive ? "action-danger" : "action-success"}" 
  onclick="openUserStatusModal(
    ${user.id}, 
    ${user.isActive}
  )"
>
  ${user.isActive ? "Deactivate" : "Activate"}
</button>

            <button
              type="button"
              class="action-button"
              onclick="openResetPasswordModal(${user.id}, '${escapedUsername}')">
              Reset Password
            </button>

          </div>
        </td>

      </tr>
    `;
    })
    .join("");
}

// ==========================================
// FILTER USERS
// ==========================================

function filterUsers() {
  renderUsers();
}

// ==========================================
// FORMAT ROLE
// ==========================================

function formatUserRole(role) {
  const roles = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    TEACHER: "Teacher",
    STUDENT: "Student",
    PARENT: "Parent",
  };

  return roles[role] || role;
}

// ==========================================
// USER INITIALS
// ==========================================

function getUserInitials(username) {
  if (!username) {
    return "US";
  }

  return username.substring(0, 2).toUpperCase();
}

// ==========================================
// FORMAT DATE
// ==========================================

function formatUserDate(date) {
  if (!date) {
    return "—";
  }

  return new Date(date).toLocaleString();
}

// ==========================================
// ESCAPE HTML
// ==========================================

function escapeUserHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// TEMPORARY ACTIONS
// ==========================================

async function viewUser(id) {
  try {
    console.log("View user clicked:", id);

    const result = await usersApi(`/api/super-admin/users/${id}`);

    const user = result.data;

    console.log("User loaded:", user);

    const username = document.getElementById("viewUserUsername");

    const email = document.getElementById("viewUserEmail");

    const role = document.getElementById("viewUserRole");

    const institution = document.getElementById("viewUserInstitution");

    const status = document.getElementById("viewUserStatus");

    const lastLogin = document.getElementById("viewUserLastLogin");

    if (username) {
      username.textContent = user.username || "-";
    }

    if (email) {
      email.textContent = user.email || "-";
    }

    if (role) {
      role.textContent = formatUserRole(user.role);
    }

    if (institution) {
      institution.textContent = user.institution?.name || "No institution";
    }

    if (status) {
      status.textContent = user.isActive ? "Active" : "Inactive";
    }

    if (lastLogin) {
      lastLogin.textContent = user.lastLoginAt
        ? formatUserDate(user.lastLoginAt)
        : "Never";
    }

    const editButton = document.getElementById("editUserFromViewButton");

    if (editButton) {
      editButton.dataset.userId = user.id;
    }

    openModal("viewUserModal");
  } catch (error) {
    console.error("View user error:", error);

    alert(error.message);
  }
}
//furnction for edit user

async function editUser(id) {
  try {
    console.log("Edit user clicked:", id);

    const result = await usersApi(`/api/super-admin/users/${id}`);

    const user = result.data;

    document.getElementById("userId").value = user.id;

    document.getElementById("userUsername").value = user.username || "";

    document.getElementById("userEmail").value = user.email || "";

    document.getElementById("userRole").value = user.role || "";

    document.getElementById("userInstitution").value = user.institutionId || "";

    document.getElementById("userIsActive").checked = user.isActive;

    document.getElementById("userFormTitle").textContent = "Edit User";

    const passwordField = document.getElementById("userPassword");

    if (passwordField) {
      passwordField.value = "";
      passwordField.required = false;
    }

    const message = document.getElementById("userFormMessage");

    if (message) {
      message.textContent = "";
    }

    openModal("userFormModal");
  } catch (error) {
    console.error("Edit user error:", error);

    alert(error.message);
  }
}
window.viewUser = viewUser;
window.editUser = editUser;
window.openCreateUserModal = openCreateUserModal;
window.openUserStatusModal = openUserStatusModal;
window.openResetPasswordModal = openResetPasswordModal;
window.closeModal = closeModal;
window.loadInstitutions = loadInstitutions;
