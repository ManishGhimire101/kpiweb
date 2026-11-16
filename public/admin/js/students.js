let allStudents = [];
let selectedStudentId = null;
let selectedStudentNewStatus = null;
let resetStudentPasswordUserId = null;

// =====================================================
// PAGE LOAD
// =====================================================
function initializeStudents() {
  loadStudents();
  initializeStudentFilters();
  initializeStudentViewModal();
  initializeStudentStatusModal();
  initializeStudentResetPasswordModal();
}

function filterStudents() {
  // our existing filter code
}

async function viewStudent(id) {
  const modal = document.getElementById("studentViewModal");
  const loading = document.getElementById("studentViewLoading");
  const content = document.getElementById("studentViewContent");
  const errorBox = document.getElementById("studentViewError");

  if (!modal) {
    console.error("Student view modal not found");
    return;
  }

  // Open modal
  modal.style.display = "flex";

  // Reset
  loading.style.display = "block";
  content.style.display = "none";
  errorBox.style.display = "none";

  try {
    const token = getAdminToken();

    const response = await fetch(`/api/admin/students/${id}`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        adminLogout();
        return;
      }

      throw new Error(result.message || "Failed to load student");
    }

    const student = result.data;

    populateStudentView(student);

    loading.style.display = "none";
    content.style.display = "block";

    // Store ID for Edit button
    const editButton = document.getElementById("editStudentFromViewButton");

    if (editButton) {
      editButton.dataset.studentId = id;
    }
  } catch (error) {
    console.error("Student view error:", error);

    loading.style.display = "none";

    errorBox.textContent =
      error.message || "Failed to load student information.";

    errorBox.style.display = "block";
  }
}
function populateStudentView(student) {
  const user = student.user || {};

  const parent = student.parentStudents?.[0]?.parent || {};

  const parentUser = parent.user || {};

  // =========================
  // STUDENT
  // =========================

  const fullName =
    `${student.firstName || ""} ${student.lastName || ""}`.trim();

  document.getElementById("viewStudentName").textContent = fullName || "-";

  document.getElementById("viewStudentCode").textContent =
    `Student Code: ${student.studentCode || "-"}`;

  document.getElementById("viewStudentFirstName").textContent =
    student.firstName || "-";

  document.getElementById("viewStudentLastName").textContent =
    student.lastName || "-";

  document.getElementById("viewStudentDob").textContent = formatDate(
    student.dob,
  );

  document.getElementById("viewStudentGender").textContent =
    student.gender || "-";

  document.getElementById("viewStudentPhone").textContent =
    student.phone || "-";

  document.getElementById("viewStudentAddress").textContent =
    student.address || "-";

  document.getElementById("viewStudentAdmissionDate").textContent = formatDate(
    student.admissionDate,
  );

  // =========================
  // STATUS
  // =========================

  const status = student.status || (user.isActive ? "ACTIVE" : "INACTIVE");

  const statusElement = document.getElementById("viewStudentStatus");

  statusElement.textContent = status;

  statusElement.className = `status-badge ${
    status === "ACTIVE" ? "status-active" : "status-inactive"
  }`;

  // =========================
  // ACCOUNT
  // =========================

  document.getElementById("viewStudentUsername").textContent =
    user.username || "-";

  document.getElementById("viewStudentAccountStatus").textContent =
    user.isActive ? "Active" : "Inactive";

  document.getElementById("viewStudentLastLogin").textContent = formatDateTime(
    user.lastLoginAt,
  );

  document.getElementById("viewStudentCreatedAt").textContent = formatDateTime(
    user.createdAt,
  );

  // =========================
  // PARENT
  // =========================

  const parentName =
    `${parent.firstName || ""} ${parent.lastName || ""}`.trim();

  document.getElementById("viewParentName").textContent = parentName || "-";

  document.getElementById("viewParentRelationship").textContent =
    student.parentStudents?.[0]?.relationship || "-";

  document.getElementById("viewParentEmail").textContent =
    parentUser.email || "-";

  document.getElementById("viewParentPhone").textContent = parent.phone || "-";

  document.getElementById("viewParentOccupation").textContent =
    parent.occupation || "-";

  document.getElementById("viewParentAddress").textContent =
    parent.address || "-";
}
function initializeStudentViewModal() {
  const modal = document.getElementById("studentViewModal");

  const closeButton = document.getElementById("closeStudentViewButton");

  const closeFooterButton = document.getElementById(
    "closeStudentViewFooterButton",
  );

  const overlay = document.getElementById("studentViewModalOverlay");

  const editButton = document.getElementById("editStudentFromViewButton");

  function closeModal() {
    if (modal) {
      modal.style.display = "none";
    }
  }

  if (closeButton) {
    closeButton.addEventListener("click", closeModal);
  }

  if (closeFooterButton) {
    closeFooterButton.addEventListener("click", closeModal);
  }

  if (overlay) {
    overlay.addEventListener("click", closeModal);
  }

  if (editButton) {
    editButton.addEventListener("click", () => {
      const studentId = editButton.dataset.studentId;

      if (!studentId) {
        return;
      }

      editStudent(studentId);
    });
  }
}
function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function editStudent(id) {
  // later
}

// =====================================================
// LOAD STUDENTS
// =====================================================

async function loadStudents() {
  const token = getAdminToken();

  const tableBody = document.getElementById("studentsTableBody");

  try {
    const response = await fetch("/api/admin/students", {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        adminLogout();
        return;
      }

      throw new Error(result.message || "Failed to load students");
    }

    allStudents = result.data || [];

    renderStudents(allStudents);
  } catch (error) {
    console.error("Students loading error:", error);

    tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-cell">
                    Failed to load students
                </td>
            </tr>
        `;
  }
}

// =====================================================
// RENDER STUDENTS
// =====================================================

function renderStudents(students) {
  const tableBody = document.getElementById("studentsTableBody");

  const emptyState = document.getElementById("emptyState");

  if (!students.length) {
    tableBody.innerHTML = "";

    emptyState.style.display = "block";

    return;
  }

  emptyState.style.display = "none";

  tableBody.innerHTML = students
    .map((student) => {
      const profile = student;

      const user = student.user || {};

      const fullName =
        `${profile.firstName || ""} ${profile.lastName || ""}`.trim();

      const status = profile.status || (user.isActive ? "ACTIVE" : "INACTIVE");
      const isActive = profile.user?.isActive;

      const statusButton = `
            <button
        type="button"
        class="student-status-button ${isActive ? "active" : "inactive"}"
        onclick="openStudentStatusModal(${profile.id}, ${isActive})"
         >
        ${isActive ? "Deactivate" : "Activate"}
            </button>
            `;

      const statusClass =
        status === "ACTIVE" ? "status-active" : "status-inactive";

      return `

                <tr>

                    <td>
                        <span class="student-code">
                            ${escapeHtml(profile.studentCode)}
                        </span>
                    </td>


                    <td>

                        <div class="student-name">
                            ${escapeHtml(fullName)}
                        </div>

                    </td>


                    <td>
                        ${escapeHtml(profile.phone || "-")}
                    </td>


                    <td>
                        ${escapeHtml(user.username || "-")}
                    </td>


                    <td>

                        <span class="status-badge ${profile.user?.isActive ? "status-active" : "status-inactive"}">
                            ${profile.user?.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>

                    </td>


                    <td style="    justify-content: center;
                                    display: flex;">

                        <button
                            class="action-button"
                            onclick="viewStudent(${profile.id})"
                        >
                            View
                        </button>


                        <button
                            class="action-button"
                            onclick="editStudent(${profile.id})"
                        >
                            Edit
                        </button>
                        


                       ${statusButton}

                       <button
                             class="action-button"
                            onclick="openStudentResetPasswordModal(
                                ${profile.user?.id},
                                '${profile.user?.username || ""}'
                                 )"
                                    >
                            Reset Password
                            </button>

                    </td>
                    

                </tr>

            `;
    })
    .join("");
}

// =====================================================
// SEARCH + FILTER
// =====================================================

function initializeStudentFilters() {
  const search = document.getElementById("studentSearch");

  const statusFilter = document.getElementById("statusFilter");

  search.addEventListener("input", filterStudents);

  statusFilter.addEventListener("change", filterStudents);
}

function filterStudents() {
  const searchValue = document
    .getElementById("studentSearch")
    .value.toLowerCase()
    .trim();

  const statusValue = document.getElementById("statusFilter").value;

  const filtered = allStudents.filter((student) => {
    const fullName =
      `${student.firstName || ""} ${student.lastName || ""}`.toLowerCase();

    const code = (student.studentCode || "").toLowerCase();

    const username = student.user?.username?.toLowerCase() || "";

    const status =
      student.status || (student.user?.isActive ? "ACTIVE" : "INACTIVE");

    const matchesSearch =
      !searchValue ||
      fullName.includes(searchValue) ||
      code.includes(searchValue) ||
      username.includes(searchValue);

    const matchesStatus = statusValue === "ALL" || status === statusValue;

    return matchesSearch && matchesStatus;
  });

  renderStudents(filtered);
}

// =====================================================
// EDIT STUDENT
// =====================================================

function editStudent(id) {
  window.location.href = `/admin/students/${id}/edit`;
}

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {
  const div = document.createElement("div");

  div.textContent = value ?? "";

  return div.innerHTML;
}

function openStudentStatusModal(id, currentlyActive) {
  console.log("Student status button clicked:", id, currentlyActive);

  selectedStudentId = Number(id);
  selectedStudentNewStatus = !currentlyActive;

  const message = document.getElementById("studentStatusMessage");

  const confirmText = document.getElementById("studentStatusConfirmText");

  const title = document.getElementById("studentStatusTitle");

  const confirmButton = document.getElementById("confirmStudentStatusButton");

  if (selectedStudentNewStatus) {
    if (title) {
      title.textContent = "Activate Student";
    }

    if (message) {
      message.textContent = "Are you sure you want to activate this student?";
    }

    if (confirmText) {
      confirmText.textContent =
        "Activating this student will allow the student to log in.";
    }

    if (confirmButton) {
      confirmButton.textContent = "Activate";
    }
  } else {
    if (title) {
      title.textContent = "Deactivate Student";
    }

    if (message) {
      message.textContent = "Are you sure you want to deactivate this student?";
    }

    if (confirmText) {
      confirmText.textContent =
        "Deactivating this student will prevent the student from logging in.";
    }

    if (confirmButton) {
      confirmButton.textContent = "Deactivate";
    }
  }

  const modal = document.getElementById("studentStatusModal");

  if (modal) {
    modal.style.display = "flex";
  }
}
async function updateStudentStatus() {
  if (!selectedStudentId) {
    return;
  }

  try {
    const token = getAdminToken();

    const response = await fetch(
      `/api/admin/students/${selectedStudentId}/status`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          accountStatus: selectedStudentNewStatus,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        adminLogout();
        return;
      }

      throw new Error(result.message || "Failed to update student status");
    }

    const modal = document.getElementById("studentStatusModal");

    if (modal) {
      modal.style.display = "none";
    }

    selectedStudentId = null;
    selectedStudentNewStatus = null;

    await loadStudents();
  } catch (error) {
    console.error("Update student status error:", error);

    alert(error.message || "Failed to update student status.");
  }
}
function initializeStudentStatusModal() {
  const closeButton = document.getElementById("closeStudentStatusButton");

  const cancelButton = document.getElementById("cancelStudentStatusButton");

  const overlay = document.getElementById("studentStatusModalOverlay");

  const confirmButton = document.getElementById("confirmStudentStatusButton");

  function closeStatusModal() {
    const modal = document.getElementById("studentStatusModal");

    if (modal) {
      modal.style.display = "none";
    }

    selectedStudentId = null;
    selectedStudentNewStatus = null;
  }

  if (closeButton) {
    closeButton.addEventListener("click", closeStatusModal);
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", closeStatusModal);
  }

  if (overlay) {
    overlay.addEventListener("click", closeStatusModal);
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", updateStudentStatus);
  }
}
function openStudentResetPasswordModal(id, username) {
  resetStudentPasswordUserId = Number(id);

  const usernameElement = document.getElementById(
    "studentResetPasswordUsername",
  );

  const passwordInput = document.getElementById("studentResetPasswordInput");

  if (usernameElement) {
    usernameElement.textContent = username || "Student";
  }

  if (passwordInput) {
    passwordInput.value = "";
  }

  const modal = document.getElementById("studentResetPasswordModal");

  if (modal) {
    modal.style.display = "flex";
  }
}
async function resetStudentPassword() {
  if (!resetStudentPasswordUserId) {
    return;
  }

  const passwordInput = document.getElementById("studentResetPasswordInput");

  const password = passwordInput?.value || "";

  if (password.length < 8) {
    alert("Password must be at least 8 characters.");
    return;
  }

  try {
    const token = getAdminToken();

    const response = await fetch(
      `/api/admin/students/${resetStudentPasswordUserId}/reset-password`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          password,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        adminLogout();
        return;
      }

      throw new Error(result.message || "Failed to reset password");
    }

    alert(result.message || "Password reset successfully.");

    closeStudentResetPasswordModal();
  } catch (error) {
    console.error("Reset student password error:", error);

    alert(error.message);
  }
}
function closeStudentResetPasswordModal() {
  const modal = document.getElementById("studentResetPasswordModal");

  if (modal) {
    modal.style.display = "none";
  }

  const passwordInput = document.getElementById("studentResetPasswordInput");

  if (passwordInput) {
    passwordInput.value = "";
  }

  resetStudentPasswordUserId = null;
}
function initializeStudentResetPasswordModal() {
  const closeButton = document.getElementById(
    "closeStudentResetPasswordButton",
  );

  const cancelButton = document.getElementById(
    "cancelStudentResetPasswordButton",
  );

  const overlay = document.getElementById("studentResetPasswordModalOverlay");

  const confirmButton = document.getElementById(
    "confirmStudentResetPasswordButton",
  );

  if (closeButton) {
    closeButton.addEventListener("click", closeStudentResetPasswordModal);
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", closeStudentResetPasswordModal);
  }

  if (overlay) {
    overlay.addEventListener("click", closeStudentResetPasswordModal);
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", resetStudentPassword);
  }
}
