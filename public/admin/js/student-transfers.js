let transferInstitutions = [];
let selectedTransferStudentId = null;
let selectedTransferInstitutionId = null;

function initializeStudentTransferCard() {
  const mount = document.getElementById("studentTransferCardMount");
  if (!mount) return;
  fetch("/admin/components/student-transfer-card.html")
    .then((response) => { if (!response.ok) throw new Error("Unable to load transfer card"); return response.text(); })
    .then((markup) => { mount.innerHTML = markup; wireStudentTransferCard(); })
    .catch((error) => setTransferNotice(error.message));
}

function wireStudentTransferCard() {
  document.getElementById("transferInstitutionSearch")?.addEventListener("input", renderTransferInstitutions);
  document.getElementById("transferInstitutionResults")?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-institution-id]");
    if (option) selectTransferInstitution(Number(option.dataset.institutionId));
  });
  document.getElementById("submitTransferRequest")?.addEventListener("click", submitStudentTransferRequest);
  document.getElementById("closeTransferCard")?.addEventListener("click", closeStudentTransferCard);
  document.getElementById("cancelTransferCard")?.addEventListener("click", closeStudentTransferCard);
  document.getElementById("transferCardBackdrop")?.addEventListener("click", closeStudentTransferCard);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeStudentTransferCard(); });
}

async function openStudentTransferCard(studentId) {
  selectedTransferStudentId = Number(studentId);
  selectedTransferInstitutionId = null;
  const card = document.getElementById("studentTransferCard");
  const backdrop = document.getElementById("transferCardBackdrop");
  if (!card || !backdrop) return;
  const student = allStudents.find((item) => item.id === selectedTransferStudentId);
  document.getElementById("transferStudentLabel").textContent = student ? `Request a transfer for ${`${student.firstName || ""} ${student.lastName || ""}`.trim()} (${student.studentCode || ""}).` : "Choose a receiving institution to request a transfer.";
  document.getElementById("transferInstitutionSearch").value = "";
  document.getElementById("transferRequestNote").value = "";
  document.getElementById("transferCardMessage").hidden = true;
  document.getElementById("submitTransferRequest").disabled = true;
  document.getElementById("selectedTransferInstitution").hidden = true;
  document.getElementById("transferInstitutionResults").hidden = true;
  document.getElementById("transferInstitutionResults").innerHTML = "";
  card.hidden = false;
  backdrop.hidden = false;
  document.body.classList.add("transfer-card-open");
  document.getElementById("transferInstitutionSearch").focus();
  const results = document.getElementById("transferInstitutionResults");
  results.hidden = true;
  try {
    const response = await fetch("/api/admin/student-transfers/institutions", { headers: { Authorization: `Bearer ${getAdminToken()}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load institutions");
    transferInstitutions = result.data || [];
  } catch (error) {
    results.innerHTML = `<div class="transfer-institution-empty">${escapeHtml(error.message)}</div>`;
    results.hidden = false;
  }
}

function closeStudentTransferCard() {
  const card = document.getElementById("studentTransferCard");
  const backdrop = document.getElementById("transferCardBackdrop");
  if (card) card.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove("transfer-card-open");
}

function renderTransferInstitutions() {
  const results = document.getElementById("transferInstitutionResults");
  if (!results) return;
  selectedTransferInstitutionId = null;
  document.getElementById("selectedTransferInstitution").hidden = true;
  document.getElementById("submitTransferRequest").disabled = true;
  const query = (document.getElementById("transferInstitutionSearch")?.value || "").trim().toLowerCase();
  if (selectedTransferInstitutionId) {
    results.hidden = true;
    return;
  }
  if (!query) {
    results.hidden = true;
    results.innerHTML = "";
    return;
  }
  const matches = transferInstitutions.filter((item) => `${item.name} ${item.code} ${item.subdomain || ""}`.toLowerCase().includes(query));
  results.hidden = false;
  if (!matches.length) {
    results.innerHTML = `<div class="transfer-institution-empty">${transferInstitutions.length ? "No institutions match your search." : "No other active institutions were found."}</div>`;
    return;
  }
  results.innerHTML = matches.slice(0, 8).map((item) => `<button type="button" class="transfer-institution-option" data-institution-id="${item.id}" role="option"><span class="transfer-institution-avatar">${escapeHtml(item.code.slice(0, 2).toUpperCase())}</span><span class="transfer-institution-details"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.type || "Institution")} · Code: ${escapeHtml(item.code)}</span></span><span class="transfer-option-check">›</span></button>`).join("");
}

function selectTransferInstitution(institutionId) {
  const institution = transferInstitutions.find((item) => item.id === institutionId);
  if (!institution) return;
  selectedTransferInstitutionId = institutionId;
  const selected = document.getElementById("selectedTransferInstitution");
  const portal = institution.subdomain ? `${institution.subdomain}.${window.location.hostname.split(".").slice(-2).join(".")}` : null;
  selected.innerHTML = `<div class="selected-institution-heading">${institution.logo ? `<img src="${escapeHtml(institution.logo)}" alt="">` : `<span class="selected-institution-monogram">${escapeHtml(institution.code.slice(0, 2).toUpperCase())}</span>`}<div><strong>${escapeHtml(institution.name)}</strong><span>${escapeHtml(institution.type || "Institution")} · ${escapeHtml(institution.code)}</span></div><button type="button" class="change-transfer-institution" id="changeTransferInstitution">Change</button></div><div class="selected-institution-info">${institution.address ? `<span><b>Address</b>${escapeHtml(institution.address)}</span>` : ""}${institution.phone ? `<span><b>Phone</b>${escapeHtml(institution.phone)}</span>` : ""}${institution.email ? `<span><b>Email</b>${escapeHtml(institution.email)}</span>` : ""}${portal ? `<span><b>Portal</b>${escapeHtml(portal)}</span>` : institution.website ? `<span><b>Website</b>${escapeHtml(institution.website)}</span>` : ""}</div>`;
  selected.hidden = false;
  document.getElementById("transferInstitutionSearch").value = "";
  document.getElementById("transferInstitutionResults").hidden = true;
  document.getElementById("changeTransferInstitution").addEventListener("click", () => {
    selectedTransferInstitutionId = null;
    selected.hidden = true;
    document.getElementById("submitTransferRequest").disabled = true;
    document.getElementById("transferInstitutionSearch").focus();
  });
  document.getElementById("submitTransferRequest").disabled = false;
  renderTransferInstitutions();
}

async function submitStudentTransferRequest() {
  const submit = document.getElementById("submitTransferRequest");
  if (!selectedTransferStudentId || !selectedTransferInstitutionId) return;
  submit.disabled = true;
  submit.textContent = "Sending…";
  try {
    const response = await fetch("/api/admin/student-transfers", {
      method: "POST",
      headers: { Authorization: `Bearer ${getAdminToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selectedTransferStudentId, destinationInstitutionId: selectedTransferInstitutionId, note: document.getElementById("transferRequestNote").value.trim() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not send transfer request");
    showTransferCardMessage("success", `Request sent to ${result.data?.destinationInstitution?.name || "the receiving institution"}. You can track its status on the Student Transfers page.`);
    submit.textContent = "Request sent";
    setTimeout(closeStudentTransferCard, 1800);
  } catch (error) {
    showTransferCardMessage("error", error.message);
    submit.disabled = false;
    submit.textContent = "Send transfer request";
  }
}

function showTransferCardMessage(kind, message) {
  const box = document.getElementById("transferCardMessage");
  if (!box) return;
  box.className = `transfer-card-message ${kind}`;
  box.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" data-dismiss-transfer-message aria-label="Dismiss" onclick="this.parentElement.hidden=true">×</button>`;
  box.hidden = false;
}

function setTransferNotice(message) {
  const box = document.getElementById("transferNotice");
  if (box) { box.textContent = message; box.hidden = false; }
}

function initializeStudentTransfers() {
  initializeTransferStudentSearch();
  loadTransferRequests();
}

async function initializeTransferStudentSearch() {
  const input = document.getElementById("transferStudentSearch");
  const results = document.getElementById("transferStudentResults");
  if (!input || !results) return;
  results.innerHTML = '<p class="muted">Loading students…</p>';
  try {
    const response = await fetch("/api/admin/students", { headers: { Authorization: `Bearer ${getAdminToken()}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load students");
    const students = result.data || [];
    results.innerHTML = students.length ? '<p class="muted">Type at least 2 characters to find a student.</p>' : '<p class="muted">No students found in this institution.</p>';
    input.disabled = !students.length;
    input.addEventListener("input", () => renderTransferStudentResults(students, input.value, results));
    results.addEventListener("click", (event) => {
      const button = event.target.closest("[data-transfer-student]");
      if (button) openStudentTransferCard(Number(button.dataset.transferStudent));
    });
  } catch (error) {
    results.textContent = error.message;
  }
}

function renderTransferStudentResults(students, rawQuery, results) {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) {
    results.innerHTML = '<p class="muted">Type at least 2 characters to find a student.</p>';
    return;
  }
  const matches = students.filter((student) => `${student.firstName || ""} ${student.lastName || ""} ${student.studentCode || ""}`.toLowerCase().includes(query)).slice(0, 20);
  results.innerHTML = matches.length ? matches.map((student) => `<div class="transfer-student-result"><div><strong>${escapeHtml(`${student.firstName || ""} ${student.lastName || ""}`.trim())}</strong><span>${escapeHtml(student.studentCode || "")} · ${escapeHtml(student.status || "")}</span></div><button type="button" class="primary-button" data-transfer-student="${student.id}">Transfer</button></div>`).join("") : '<p class="muted">No students match your search.</p>';
}

async function loadTransferRequests() {
  const headers = { Authorization: `Bearer ${getAdminToken()}` };
  try {
    const [incomingResponse, outgoingResponse] = await Promise.all([
      fetch("/api/admin/student-transfers/incoming", { headers }),
      fetch("/api/admin/student-transfers/outgoing", { headers }),
    ]);
    const [incoming, outgoing] = await Promise.all([incomingResponse.json(), outgoingResponse.json()]);
    if (!incomingResponse.ok || !outgoingResponse.ok) throw new Error(incoming.message || outgoing.message || "Unable to load transfers");
    renderIncomingTransfers(incoming.data || []);
    renderOutgoingTransfers(outgoing.data || []);
  } catch (error) {
    const incomingTarget = document.getElementById("incomingTransfers");
    const outgoingTarget = document.getElementById("outgoingTransfers");
    if (incomingTarget) incomingTarget.textContent = error.message;
    if (outgoingTarget) outgoingTarget.textContent = error.message;
  }
}

function renderIncomingTransfers(items) {
  const container = document.getElementById("incomingTransfers");
  if (!container) return;
  if (!items.length) { container.textContent = "No incoming requests."; return; }
  container.innerHTML = items.map((request) => {
    const student = request.student || {};
    const parent = student.parentStudents?.[0]?.parent || {};
    const name = `${student.firstName || ""} ${student.lastName || ""}`.trim();
    const controls = request.status === "PENDING" ? `<div class="transfer-actions"><button class="primary-button" onclick="respondToTransfer(${request.id}, 'ACCEPTED')">Accept</button><button class="secondary-button" onclick="respondToTransfer(${request.id}, 'REJECTED')">Reject</button></div>` : "";
    return `<article class="transfer-request"><div class="transfer-request-heading"><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(student.studentCode || "")} · from ${escapeHtml(request.sourceInstitution?.name || "")}</span></div><span class="transfer-status transfer-status-${request.status.toLowerCase()}">${escapeHtml(request.status)}</span></div><p>Student: ${escapeHtml(student.phone || "No phone")} · ${escapeHtml(student.gender || "")}</p><p>Parent: ${escapeHtml(`${parent.firstName || ""} ${parent.lastName || ""}`.trim() || "Not provided")} · ${escapeHtml(parent.phone || "No phone")} · login: ${escapeHtml(parent.user?.username || "-")}</p>${request.note ? `<p>Note: ${escapeHtml(request.note)}</p>` : ""}${request.status === "ACCEPTED" ? `<p class="transfer-footnote">Transfer completed. Previous attendance, submissions, and complaints remain in the read-only transfer archive.</p>` : ""}${controls}</article>`;
  }).join("");
}

function renderOutgoingTransfers(items) {
  const container = document.getElementById("outgoingTransfers");
  if (!container) return;
  if (!items.length) { container.textContent = "No outgoing requests."; return; }
  container.innerHTML = items.map((request) => `<article class="transfer-request"><div class="transfer-request-heading"><div><strong>${escapeHtml(`${request.student?.firstName || ""} ${request.student?.lastName || ""}`.trim())}</strong><span>${escapeHtml(request.student?.studentCode || "")} · to ${escapeHtml(request.destinationInstitution?.name || "")}</span></div><span class="transfer-status transfer-status-${request.status.toLowerCase()}">${escapeHtml(request.status)}</span></div>${request.responseNote ? `<p>${escapeHtml(request.responseNote)}</p>` : ""}${request.status === "PENDING" ? `<div class="transfer-actions"><button class="secondary-button" onclick="cancelStudentTransfer(${request.id})">Cancel request</button></div>` : ""}</article>`).join("");
}

async function cancelStudentTransfer(id) {
  const notice = document.getElementById("transferActionNotice");
  try {
    const response = await fetch(`/api/admin/student-transfers/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getAdminToken()}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not cancel request");
    setActionNotice(notice, "success", result.message);
    loadTransferRequests();
  } catch (error) { setActionNotice(notice, "error", error.message); }
}

async function respondToTransfer(id, decision) {
  const notice = document.getElementById("transferActionNotice");
  const message = decision === "REJECTED" ? "Reject this student's transfer request?" : "Accept this student's transfer request and move their account to this institution?";
  if (!confirm(message)) return;
  try {
    const response = await fetch(`/api/admin/student-transfers/${id}/respond`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getAdminToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to respond to transfer");
    const parentUsers = result.data?.parentLogins?.map((parent) => `${parent.username}${parent.isPrimary ? " (primary)" : ""}`).join(", ");
    setActionNotice(notice, "success", parentUsers ? `${result.message} Destination parent usernames: ${parentUsers}. Their existing password is retained.` : result.message);
    loadTransferRequests();
  } catch (error) { setActionNotice(notice, "error", error.message); }
}

function setActionNotice(target, type, message) {
  if (!target) return;
  target.className = `transfer-card-message ${type}`;
  target.textContent = message;
  target.hidden = false;
}
