(function () {
  const { esc, api, toast, fmtDate, fmtDateTime, badge, filesHtml, modal } = Portal;

  async function renderHome(view, user) {
    const [me, homework, att] = await Promise.all([
      api("/api/student/me").then((r) => r.data),
      api("/api/student/homework").then((r) => r.data),
      api("/api/student/attendance"),
    ]);

    const pending = homework.filter((h) => h.status === "PENDING" || h.status === "OVERDUE");

    view.innerHTML = `
      <div class="page-head"><h2>Hello, ${esc(me.name)}</h2></div>
      ${me.classLabel ? "" : '<div class="card">You have not been placed in a class yet. Ask your institution admin.</div>'}
      <div class="grid" style="margin-bottom:20px">
        <div class="stat"><span>Class</span><strong style="font-size:20px">${esc(me.classLabel || "-")}</strong></div>
        <div class="stat"><span>Homework to do</span><strong>${pending.length}</strong></div>
        <div class="stat"><span>Attendance</span><strong>${att.summary.percentage === null ? "-" : `${att.summary.percentage}%`}</strong></div>
      </div>
      <h3 style="margin-bottom:10px">Due soon</h3>
      ${
        pending.length
          ? pending
              .slice(0, 5)
              .map(
                (h) => `<div class="card"><div class="item-head"><div><h3>${esc(h.title)}</h3>
              <div class="item-meta">${esc(h.subject || "")} &middot; Due ${fmtDate(h.dueDate)}</div></div>${badge(h.status)}</div></div>`,
              )
              .join("")
          : '<div class="empty">You are all caught up.</div>'
      }`;
  }

  async function renderHomework(view) {
    const list = (await api("/api/student/homework")).data;

    view.innerHTML = `<div class="page-head"><h2>Homework</h2></div>
      ${
        list.length
          ? list
              .map((h) => {
                const s = h.submission;
                return `<div class="card">
              <div class="item-head"><div><h3>${esc(h.title)}</h3>
              <div class="item-meta">${esc(h.subject || "")}${h.subject ? " &middot; " : ""}${esc(h.teacherName || "")} &middot; Due ${fmtDate(h.dueDate)}</div></div>${badge(h.status)}</div>
              ${h.description ? `<p>${esc(h.description)}</p>` : ""}${filesHtml(h.files)}
              ${
                s
                  ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
                <div class="small muted">Your submission &middot; ${fmtDateTime(s.submittedAt)}${s.isLate ? " &middot; submitted late" : ""}</div>
                ${s.note ? `<p>${esc(s.note)}</p>` : ""}${filesHtml(s.files)}
                ${s.reviewedAt ? `<p style="margin-top:8px"><strong>Grade:</strong> ${esc(s.grade || "-")}${s.feedback ? ` &middot; <strong>Feedback:</strong> ${esc(s.feedback)}` : ""}</p>` : ""}</div>`
                  : ""
              }
              ${!s || !s.reviewedAt ? `<div class="toolbar" style="margin:10px 0 0"><button class="btn small" data-submit="${h.id}" data-title="${esc(h.title)}">${s ? "Resubmit" : "Submit homework"}</button></div>` : ""}</div>`;
              })
              .join("")
          : '<div class="empty">No homework has been assigned yet.</div>'
      }`;

    view.querySelectorAll("[data-submit]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const m = modal(`<h3>Submit: ${esc(btn.dataset.title)}</h3>
          <form>
            <div class="form-error" hidden></div>
            <div class="field"><label>Files</label><input type="file" name="files" multiple><div class="hint">Up to 5 files, 10MB each. Uploading new files replaces earlier ones.</div></div>
            <div class="field"><label>Note to teacher</label><textarea name="note" maxlength="2000"></textarea></div>
            <div class="modal-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" type="submit">Submit</button></div>
          </form>`);
        const form = m.el.querySelector("form");
        const error = form.querySelector(".form-error");

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          error.hidden = true;
          const button = form.querySelector("button[type=submit]");
          button.disabled = true;

          try {
            const result = await api(`/api/student/homework/${btn.dataset.submit}/submit`, { method: "POST", form: new FormData(form) });
            m.close();
            toast(result.message, "success");
            Portal.refresh();
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
            button.disabled = false;
          }
        });
      }),
    );
  }

  async function renderResources(view) {
    const list = (await api("/api/student/resources")).data;

    view.innerHTML = `<div class="page-head"><h2>Class resources</h2></div>
      ${
        list.length
          ? list
              .map(
                (r) => `<div class="card"><h3>${esc(r.title)}</h3>
          <div class="item-meta">${esc(r.subject || "")}${r.subject ? " &middot; " : ""}${esc(r.teacherName)} &middot; ${fmtDate(r.createdAt)}</div>
          ${r.description ? `<p>${esc(r.description)}</p>` : ""}${filesHtml(r.files)}</div>`,
              )
              .join("")
          : '<div class="empty">Your teachers have not shared any resources yet.</div>'
      }`;
  }

  async function renderAttendance(view) {
    const result = await api("/api/student/attendance");
    const s = result.summary;

    view.innerHTML = `<div class="page-head"><h2>My attendance</h2></div>
      <div class="grid" style="margin-bottom:20px">
        <div class="stat"><span>Attendance</span><strong>${s.percentage === null ? "-" : `${s.percentage}%`}</strong></div>
        <div class="stat"><span>Present</span><strong>${s.PRESENT}</strong></div>
        <div class="stat"><span>Late</span><strong>${s.LATE}</strong></div>
        <div class="stat"><span>Absent</span><strong>${s.ABSENT}</strong></div>
        <div class="stat"><span>Excused</span><strong>${s.EXCUSED}</strong></div>
      </div>
      ${
        result.data.length
          ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Status</th><th>Remark</th></tr></thead><tbody>
        ${result.data.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${badge(r.status)}</td><td>${esc(r.remark || "")}</td></tr>`).join("")}</tbody></table></div>`
          : '<div class="empty">No attendance has been recorded yet.</div>'
      }`;
  }

  Portal.start({
    role: "STUDENT",
    title: "Student Portal",
    tabs: [
      { id: "home", label: "Home", render: renderHome },
      { id: "homework", label: "Homework", render: renderHomework },
      { id: "resources", label: "Resources", render: renderResources },
      { id: "attendance", label: "Attendance", render: renderAttendance },
    ],
  });
})();
