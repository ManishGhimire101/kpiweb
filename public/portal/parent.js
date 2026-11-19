(function () {
  const { esc, api, toast, fmtDate, fmtDateTime, badge, filesHtml } = Portal;

  async function renderChildren(view) {
    const children = (await api("/api/parent/children")).data;

    view.innerHTML = `<div class="page-head"><h2>My children</h2></div>
      ${
        children.length
          ? `<div class="grid">${children
              .map(
                (c) => `<div class="card"><h3>${esc(c.name)}</h3>
          <div class="item-meta">${esc(c.classLabel || "No class")} &middot; ${esc(c.studentCode)}${c.relationship ? ` &middot; ${esc(c.relationship)}` : ""}</div>
          <p class="small">Attendance: <strong>${c.attendance.percentage === null ? "-" : `${c.attendance.percentage}%`}</strong> (${c.attendance.ABSENT} absent)</p>
          ${c.unreadComplaints ? `<p class="small"><span class="badge warn">${c.unreadComplaints} unread message(s)</span></p>` : ""}
          <div class="toolbar" style="margin:10px 0 0"><button class="btn small" data-child="${c.id}">View details</button></div></div>`,
              )
              .join("")}</div>`
          : '<div class="empty">No children are linked to your account.</div>'
      }`;

    view.querySelectorAll("[data-child]").forEach((b) => b.addEventListener("click", () => childDetail(view, b.dataset.child)));
  }

  async function childDetail(view, id) {
    const c = (await api(`/api/parent/children/${id}/overview`)).data;
    c.fees = null;
    const s = c.attendanceSummary;
    let section = "homework";

    function body() {
      if (section === "fees" && !c.fees) return '<div class="empty">Loading fee bills...</div>';
      if (section === "homework") {
        return c.homework.length
          ? `<div class="table-wrap"><table class="table"><thead><tr><th>Homework</th><th>Due</th><th>Status</th><th>Grade</th></tr></thead><tbody>
          ${c.homework
            .map(
              (h) => `<tr><td><strong>${esc(h.title)}</strong><div class="muted small">${esc(h.subject || "")} ${esc(h.teacherName)}</div></td>
            <td>${fmtDate(h.dueDate)}</td><td>${badge(h.status)}${h.isLate ? ' <span class="badge bad">Late</span>' : ""}</td>
            <td>${esc(h.grade || "-")}${h.feedback ? `<div class="muted small">${esc(h.feedback)}</div>` : ""}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
          : '<div class="empty">No homework yet.</div>';
      }

      if (section === "attendance") {
        return c.attendance.length
          ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Status</th><th>Remark</th></tr></thead><tbody>
          ${c.attendance.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${badge(r.status)}</td><td>${esc(r.remark || "")}</td></tr>`).join("")}</tbody></table></div>`
          : '<div class="empty">No attendance recorded yet.</div>';
      }

      if (section === "fees") {
        return c.fees.length
          ? `<div class="table-wrap"><table class="table"><thead><tr><th>Bill</th><th>Charges</th><th>Period</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          ${c.fees.map((f) => `<tr><td><strong>${esc(f.title)}</strong><div class="muted small">${esc(f.studentName)}</div></td><td>${(Array.isArray(f.lines)?f.lines:[]).map(line=>`${esc(line.heading)}: NPR ${money(line.amount)}`).join("<br>")}</td><td>${esc(f.period)} · ${esc(f.academicYear)}</td><td>NPR ${money(f.totalAmount)}</td><td>NPR ${money(f.paidAmount)}</td><td><strong>NPR ${money(f.balance)}</strong></td><td>${badge(f.status)}</td><td>${f.balance > 0 ? `<button class="btn small" data-pay="${f.id}">Pay with Khalti</button>` : ""} ${f.paidAmount > 0 ? `<button class="btn small secondary" data-receipt="${f.id}">Download receipt</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
          : '<div class="empty">No fee bills issued for this student yet.</div>';
      }

      return c.resources.length
        ? c.resources
            .map(
              (r) => `<div class="card"><h3>${esc(r.title)}</h3><div class="item-meta">${esc(r.teacherName)} &middot; ${fmtDate(r.createdAt)}</div>${filesHtml(r.files)}</div>`,
            )
            .join("")
        : '<div class="empty">No resources shared yet.</div>';
    }

    function money(value) { return Number(value || 0).toLocaleString(); }

    async function loadFees() {
      const all = (await api("/api/fees/bills")).data;
      return all.filter((fee) => fee.studentId === Number(id));
    }

    function draw() {
      view.innerHTML = `
        <div class="page-head"><h2>${esc(c.name)}</h2><button class="btn secondary" id="back">&larr; All children</button></div>
        <div class="item-meta">${esc(c.classLabel || "No class")} &middot; ${esc(c.studentCode)}</div>
        <div class="grid" style="margin:14px 0 20px">
          <div class="stat"><span>Attendance</span><strong>${s.percentage === null ? "-" : `${s.percentage}%`}</strong></div>
          <div class="stat"><span>Present / Late</span><strong>${s.PRESENT} / ${s.LATE}</strong></div>
          <div class="stat"><span>Absent</span><strong>${s.ABSENT}</strong></div>
        </div>
        <div class="toolbar">
          ${[["homework", "Homework"], ["attendance", "Attendance"], ["resources", "Resources"], ["fees", "Fees"]]
            .map(([k, l]) => `<button class="btn small ${section === k ? "" : "secondary"}" data-sec="${k}">${l}</button>`)
            .join("")}
        </div>
        ${body()}`;

      view.querySelector("#back").addEventListener("click", () => renderChildren(view));
      view.querySelectorAll("[data-sec]").forEach((b) =>
        b.addEventListener("click", () => {
          section = b.dataset.sec;
          if (section === "fees") { c.fees = null; draw(); loadFees().then((fees) => { c.fees = fees; draw(); }).catch((error) => { c.fees = []; toast(error.message, "error"); draw(); }); }
          else draw();
        }),
      );
      view.querySelectorAll("[data-pay]").forEach((button) => button.addEventListener("click", async () => {
        try {
          const result = await api(`/api/fees/bills/${button.dataset.pay}/khalti/initiate`, { method: "POST" });
          window.sessionStorage.setItem("feeReturnPending", "1");
          window.location.assign(result.data.paymentUrl);
        } catch (error) { toast(error.message, "error"); }
      }));
      view.querySelectorAll("[data-receipt]").forEach((button) => button.addEventListener("click", () => Portal.download(Portal.withTenant(`/api/fees/bills/${button.dataset.receipt}/receipt`), `fee-receipt-${button.dataset.receipt}.pdf`)));
    }

    if (location.hash === "#fees" && window.sessionStorage.getItem("feeReturnPending") === "1") {
      window.sessionStorage.removeItem("feeReturnPending");
      section = "fees";
      c.fees = await loadFees();
    }
    draw();
  }

  async function renderComplaints(view) {
    const list = (await api("/api/parent/complaints")).data;

    view.innerHTML = `<div class="page-head"><h2>Messages from teachers</h2></div>
      <p class="muted small" style="margin-bottom:12px">These notices are one-way. To discuss one, please contact the school directly.</p>
      ${
        list.length
          ? list
              .map(
                (c) => `<div class="card"><div class="item-head"><div><h3>${esc(c.subject)}</h3>
          <div class="item-meta">About ${esc(c.studentName)} &middot; from ${esc(c.teacherName)} &middot; ${fmtDateTime(c.createdAt)}</div></div>
          ${c.readAt ? '<span class="badge muted">Read</span>' : `<button class="btn small" data-read="${c.id}">Mark as read</button>`}</div>
          <p>${esc(c.message)}</p></div>`,
              )
              .join("")
          : '<div class="empty">No messages from teachers.</div>'
      }`;

    view.querySelectorAll("[data-read]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api(`/api/parent/complaints/${b.dataset.read}/read`, { method: "PATCH" });
          Portal.refresh();
        } catch (error) {
          toast(error.message, "error");
        }
      }),
    );
  }

  Portal.start({
    role: "PARENT",
    title: "Parent Portal",
    tabs: [
      { id: "children", label: "My children", render: renderChildren },
      { id: "messages", label: "Messages", render: renderComplaints },
    ],
  });
})();
