(function () {
  const { esc, api, toast, fmtDate, fmtDateTime, badge, filesHtml, modal, toInputDate } = Portal;

  let classes = [];

  async function loadClasses() {
    classes = (await api("/api/teacher/classes")).data;
    return classes;
  }

  function classOptions(selected) {
    return classes
      .map((c) => `<option value="${c.id}" ${String(selected) === String(c.id) ? "selected" : ""}>${esc(c.label)}</option>`)
      .join("");
  }

  function noClasses(view) {
    view.innerHTML =
      '<div class="empty">You have not been assigned to any class yet. Please ask your institution admin to assign you.</div>';
  }

  async function renderHome(view) {
    await loadClasses();

    if (!classes.length) return noClasses(view);

    const [homework, complaints] = await Promise.all([
      api("/api/teacher/homework").then((r) => r.data),
      api("/api/teacher/complaints").then((r) => r.data),
    ]);

    const pendingReview = homework.reduce((n, h) => n + h.submissionCount, 0);

    view.innerHTML = `
      <div class="page-head"><h2>My classes</h2></div>
      <div class="grid" style="margin-bottom:20px">
        <div class="stat"><span>Classes</span><strong>${classes.length}</strong></div>
        <div class="stat"><span>Homework assigned</span><strong>${homework.length}</strong></div>
        <div class="stat"><span>Submissions received</span><strong>${pendingReview}</strong></div>
        <div class="stat"><span>Complaints sent</span><strong>${complaints.length}</strong></div>
      </div>
      <div class="grid">
        ${classes
          .map(
            (c) => `<div class="card"><h3>${esc(c.label)}</h3>
              <div class="item-meta">${c.studentCount} student(s)${c.subjects.length ? ` &middot; ${esc(c.subjects.join(", "))}` : ""}</div>
              <div class="toolbar" style="margin:8px 0 0"><button class="btn small" data-go="attendance" data-class="${c.id}">Take attendance</button>
              <button class="btn small secondary" data-go="homework" data-class="${c.id}">Homework</button></div></div>`,
          )
          .join("")}
      </div>`;

    view.querySelectorAll("[data-go]").forEach((btn) =>
      btn.addEventListener("click", () => {
        sessionStorage.setItem("teacherClass", btn.dataset.class);
        document.querySelector(`.tab[data-tab="${btn.dataset.go}"]`).click();
      }),
    );
  }

  function pickedClass() {
    const saved = sessionStorage.getItem("teacherClass");
    return classes.find((c) => String(c.id) === saved) ? saved : classes[0] && String(classes[0].id);
  }

  async function renderHomework(view) {
    await loadClasses();
    if (!classes.length) return noClasses(view);

    let filter = pickedClass();

    async function draw() {
      const list = (await api(`/api/teacher/homework?classId=${filter}`)).data;

      view.innerHTML = `
        <div class="page-head"><h2>Homework</h2><button class="btn" id="newHw">+ Assign homework</button></div>
        <div class="toolbar"><div class="field"><label>Class</label><select id="classFilter">${classOptions(filter)}</select></div></div>
        ${
          list.length
            ? list
                .map(
                  (h) => `<div class="card">
              <div class="item-head"><div><h3>${esc(h.title)}</h3>
              <div class="item-meta">${esc(h.classLabel)}${h.subject ? ` &middot; ${esc(h.subject)}` : ""} &middot; Due ${fmtDate(h.dueDate)}</div></div>
              <span class="badge info">${h.submissionCount}/${h.studentCount} submitted</span></div>
              ${h.description ? `<p>${esc(h.description)}</p>` : ""}${filesHtml(h.files)}
              <div class="toolbar" style="margin:10px 0 0"><button class="btn small" data-open="${h.id}">View submissions</button>
              <button class="btn small danger" data-del="${h.id}">Delete</button></div></div>`,
                )
                .join("")
            : '<div class="empty">No homework assigned for this class yet.</div>'
        }`;

      view.querySelector("#classFilter").addEventListener("change", (e) => {
        filter = e.target.value;
        sessionStorage.setItem("teacherClass", filter);
        draw();
      });
      view.querySelector("#newHw").addEventListener("click", () => homeworkForm(draw, filter));
      view.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => submissionsModal(b.dataset.open, draw)));
      view.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", async () => {
          if (!confirm("Delete this homework and all submissions?")) return;
          try {
            await api(`/api/teacher/homework/${b.dataset.del}`, { method: "DELETE" });
            toast("Homework deleted", "success");
            draw();
          } catch (error) {
            toast(error.message, "error");
          }
        }),
      );
    }

    await draw();
  }

  function homeworkForm(onDone, classId) {
    const m = modal(`<h3>Assign homework</h3>
      <form>
        <div class="form-error" hidden></div>
        <div class="row">
          <div class="field"><label>Class *</label><select name="classId" required>${classOptions(classId)}</select></div>
          <div class="field"><label>Due date *</label><input type="date" name="dueDate" min="${toInputDate()}" required></div>
        </div>
        <div class="field"><label>Title *</label><input name="title" maxlength="200" required></div>
        <div class="field"><label>Subject</label><input name="subject" maxlength="80"></div>
        <div class="field"><label>Instructions</label><textarea name="description"></textarea></div>
        <div class="field"><label>Attachments</label><input type="file" name="files" multiple>
          <div class="hint">Up to 5 files, 10MB each (PDF, Office, images, text, zip).</div></div>
        <div class="modal-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" type="submit">Assign</button></div>
      </form>`);

    const form = m.el.querySelector("form");
    const error = form.querySelector(".form-error");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;

      try {
        await api("/api/teacher/homework", { method: "POST", form: new FormData(form) });
        m.close();
        toast("Homework assigned", "success");
        onDone();
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
        button.disabled = false;
      }
    });
  }

  async function submissionsModal(id, onChange) {
    const hw = (await api(`/api/teacher/homework/${id}`)).data;

    const m = modal(
      `<h3>${esc(hw.title)}</h3>
      <div class="item-meta">${esc(hw.classLabel)} &middot; Due ${fmtDate(hw.dueDate)} &middot; ${hw.submissionCount}/${hw.studentCount} submitted</div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Status</th><th>Work</th><th>Review</th></tr></thead><tbody>
      ${hw.students
        .map((s) => {
          const sub = s.submission;
          return `<tr><td><strong>${esc(s.name)}</strong><div class="muted small">${esc(s.rollNo ? `Roll ${s.rollNo}` : s.studentCode)}</div></td>
          <td>${sub ? `${badge(sub.reviewedAt ? "REVIEWED" : "SUBMITTED")}${sub.isLate ? ' <span class="badge bad">Late</span>' : ""}<div class="muted small">${fmtDateTime(sub.submittedAt)}</div>` : badge(new Date(hw.dueDate) < new Date() ? "OVERDUE" : "PENDING")}</td>
          <td>${sub ? `${sub.note ? `<div>${esc(sub.note)}</div>` : ""}${filesHtml(sub.files)}` : '<span class="muted">-</span>'}</td>
          <td>${sub ? `<div class="row" style="grid-template-columns:80px 1fr;gap:6px"><input data-grade="${sub.id}" placeholder="Grade" value="${esc(sub.grade || "")}" maxlength="20" style="padding:6px;border:1px solid #cbd5e1;border-radius:6px"><input data-fb="${sub.id}" placeholder="Feedback" value="${esc(sub.feedback || "")}" style="padding:6px;border:1px solid #cbd5e1;border-radius:6px"></div><button class="btn small" style="margin-top:6px" data-save="${sub.id}">Save</button>` : ""}</td></tr>`;
        })
        .join("")}
      </tbody></table></div>
      <div class="modal-actions"><button class="btn" data-close>Close</button></div>`,
      { wide: true },
    );

    m.el.querySelectorAll("[data-save]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const sid = btn.dataset.save;
        try {
          await api(`/api/teacher/homework/${id}/submissions/${sid}`, {
            method: "PATCH",
            body: {
              grade: m.el.querySelector(`[data-grade="${sid}"]`).value,
              feedback: m.el.querySelector(`[data-fb="${sid}"]`).value,
            },
          });
          toast("Review saved", "success");
        } catch (error) {
          toast(error.message, "error");
        }
      }),
    );
  }

  async function renderResources(view) {
    await loadClasses();
    if (!classes.length) return noClasses(view);

    let filter = pickedClass();

    async function draw() {
      const list = (await api(`/api/teacher/resources?classId=${filter}`)).data;

      view.innerHTML = `
        <div class="page-head"><h2>Class resources</h2><button class="btn" id="newRes">+ Upload resource</button></div>
        <p class="muted small" style="margin-bottom:12px">Everything uploaded here is visible to every student in the class.</p>
        <div class="toolbar"><div class="field"><label>Class</label><select id="classFilter">${classOptions(filter)}</select></div></div>
        ${
          list.length
            ? list
                .map(
                  (r) => `<div class="card"><div class="item-head"><div><h3>${esc(r.title)}</h3>
                <div class="item-meta">${esc(r.classLabel)}${r.subject ? ` &middot; ${esc(r.subject)}` : ""} &middot; ${fmtDate(r.createdAt)}</div></div>
                <button class="btn small danger" data-del="${r.id}">Delete</button></div>
                ${r.description ? `<p>${esc(r.description)}</p>` : ""}${filesHtml(r.files)}</div>`,
                )
                .join("")
            : '<div class="empty">No resources shared with this class yet.</div>'
        }`;

      view.querySelector("#classFilter").addEventListener("change", (e) => {
        filter = e.target.value;
        sessionStorage.setItem("teacherClass", filter);
        draw();
      });

      view.querySelector("#newRes").addEventListener("click", () => {
        const m = modal(`<h3>Upload resource</h3>
          <form>
            <div class="form-error" hidden></div>
            <div class="field"><label>Class *</label><select name="classId" required>${classOptions(filter)}</select></div>
            <div class="field"><label>Title *</label><input name="title" required maxlength="200"></div>
            <div class="field"><label>Subject</label><input name="subject" maxlength="80"></div>
            <div class="field"><label>Description</label><textarea name="description"></textarea></div>
            <div class="field"><label>Files *</label><input type="file" name="files" multiple required><div class="hint">Up to 5 files, 10MB each.</div></div>
            <div class="modal-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" type="submit">Share with class</button></div>
          </form>`);
        const form = m.el.querySelector("form");
        const error = form.querySelector(".form-error");

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          error.hidden = true;
          const btn = form.querySelector("button[type=submit]");
          btn.disabled = true;

          try {
            await api("/api/teacher/resources", { method: "POST", form: new FormData(form) });
            m.close();
            toast("Resource shared", "success");
            draw();
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
            btn.disabled = false;
          }
        });
      });

      view.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", async () => {
          if (!confirm("Delete this resource?")) return;
          try {
            await api(`/api/teacher/resources/${b.dataset.del}`, { method: "DELETE" });
            toast("Resource deleted", "success");
            draw();
          } catch (error) {
            toast(error.message, "error");
          }
        }),
      );
    }

    await draw();
  }

  async function renderAttendance(view) {
    await loadClasses();
    if (!classes.length) return noClasses(view);

    let classId = pickedClass();
    let date = toInputDate();

    async function draw() {
      const result = await api(`/api/teacher/attendance?classId=${classId}&date=${date}`);
      const rows = result.data;

      view.innerHTML = `
        <div class="page-head"><h2>Attendance</h2></div>
        <div class="toolbar">
          <div class="field"><label>Class</label><select id="classSel">${classOptions(classId)}</select></div>
          <div class="field"><label>Date</label><input type="date" id="dateSel" value="${date}" max="${toInputDate()}"></div>
          <button class="btn secondary" id="allPresent">Mark all present</button>
          <button class="btn secondary" id="summaryBtn">Monthly summary</button>
        </div>
        ${result.marked ? '<p class="small" style="margin-bottom:10px"><span class="badge ok">Attendance already recorded for this date - you can edit it</span></p>' : ""}
        ${
          rows.length
            ? `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Status</th><th>Remark</th></tr></thead><tbody>
          ${rows
            .map(
              (r) => `<tr data-student="${r.studentId}"><td><strong>${esc(r.name)}</strong><div class="muted small">${esc(r.rollNo ? `Roll ${r.rollNo}` : r.studentCode)}</div></td>
            <td><div class="att-options">${[["PRESENT", "P", "Present"], ["ABSENT", "A", "Absent"], ["LATE", "L", "Late"], ["EXCUSED", "E", "Excused"]]
              .map(
                ([value, cls, label]) =>
                  `<label class="${cls}"><input type="radio" name="s${r.studentId}" value="${value}" ${r.status === value ? "checked" : ""}><span>${label}</span></label>`,
              )
              .join("")}</div></td>
            <td><input data-remark style="width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:6px" maxlength="200" value="${esc(r.remark || "")}"></td></tr>`,
            )
            .join("")}</tbody></table></div>
          <div class="modal-actions"><button class="btn" id="saveAtt">Save attendance</button></div>`
            : '<div class="empty">No students are assigned to this class yet.</div>'
        }`;

      view.querySelector("#classSel").addEventListener("change", (e) => {
        classId = e.target.value;
        sessionStorage.setItem("teacherClass", classId);
        draw();
      });

      view.querySelector("#dateSel").addEventListener("change", (e) => {
        if (e.target.value) {
          date = e.target.value;
          draw();
        }
      });

      view.querySelector("#summaryBtn").addEventListener("click", () => summary(classId));

      const all = view.querySelector("#allPresent");
      all.addEventListener("click", () =>
        view.querySelectorAll('input[value="PRESENT"]').forEach((input) => (input.checked = true)),
      );

      const save = view.querySelector("#saveAtt");

      if (save) {
        save.addEventListener("click", async () => {
          const records = [];
          let missing = 0;

          view.querySelectorAll("tr[data-student]").forEach((tr) => {
            const checked = tr.querySelector("input[type=radio]:checked");
            if (!checked) {
              missing += 1;
              return;
            }
            records.push({
              studentId: Number(tr.dataset.student),
              status: checked.value,
              remark: tr.querySelector("[data-remark]").value,
            });
          });

          if (missing) {
            toast(`Mark attendance for all students (${missing} left)`, "error");
            return;
          }

          save.disabled = true;

          try {
            await api("/api/teacher/attendance", { method: "PUT", body: { classId: Number(classId), date, records } });
            toast("Attendance saved", "success");
            draw();
          } catch (error) {
            toast(error.message, "error");
            save.disabled = false;
          }
        });
      }
    }

    await draw();
  }

  async function summary(classId) {
    const result = await api(`/api/teacher/attendance/summary?classId=${classId}`);

    modal(
      `<h3>Attendance summary</h3><div class="item-meta">${result.from} to ${result.to}</div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Present</th><th>Late</th><th>Absent</th><th>Excused</th><th>%</th></tr></thead><tbody>
      ${result.data
        .map(
          (r) => `<tr><td>${esc(r.name)}</td><td>${r.summary.PRESENT}</td><td>${r.summary.LATE}</td><td>${r.summary.ABSENT}</td><td>${r.summary.EXCUSED}</td><td>${r.summary.percentage === null ? "-" : `${r.summary.percentage}%`}</td></tr>`,
        )
        .join("")}</tbody></table></div>
      <div class="modal-actions"><button class="btn" data-close>Close</button></div>`,
      { wide: true },
    );
  }

  async function renderComplaints(view) {
    await loadClasses();
    if (!classes.length) return noClasses(view);

    const list = (await api("/api/teacher/complaints")).data;

    view.innerHTML = `
      <div class="page-head"><h2>Complaints to parents</h2><button class="btn" id="newC">+ New complaint</button></div>
      <p class="muted small" style="margin-bottom:12px">Parents can read these messages but cannot reply. Use it for notices about behaviour or progress.</p>
      ${
        list.length
          ? list
              .map(
                (c) => `<div class="card"><div class="item-head"><div><h3>${esc(c.subject)}</h3>
          <div class="item-meta">${esc(c.studentName)}${c.classLabel ? ` &middot; ${esc(c.classLabel)}` : ""} &middot; ${fmtDateTime(c.createdAt)}</div></div>
          ${c.readAt ? `<span class="badge ok">Read ${fmtDate(c.readAt)}</span>` : '<span class="badge warn">Not read yet</span>'}</div>
          <p>${esc(c.message)}</p></div>`,
              )
              .join("")
          : '<div class="empty">You have not sent any complaints.</div>'
      }`;

    view.querySelector("#newC").addEventListener("click", async () => {
      const lists = await Promise.all(classes.map((c) => api(`/api/teacher/classes/${c.id}/students`).then((r) => ({ c, students: r.data }))));

      const m = modal(`<h3>Send complaint to parent</h3>
        <form>
          <div class="form-error" hidden></div>
          <div class="field"><label>Student *</label><select name="studentId" required>
            <option value="">Select a student</option>
            ${lists.map(({ c, students }) => `<optgroup label="${esc(c.label)}">${students.map((s) => `<option value="${s.id}">${esc(s.name)} (${esc(s.studentCode)})</option>`).join("")}</optgroup>`).join("")}
          </select></div>
          <div class="field"><label>Subject *</label><input name="subject" maxlength="150" required></div>
          <div class="field"><label>Message *</label><textarea name="message" minlength="5" maxlength="2000" required></textarea></div>
          <div class="modal-actions"><button type="button" class="btn secondary" data-close>Cancel</button><button class="btn" type="submit">Send</button></div>
        </form>`);

      const form = m.el.querySelector("form");
      const error = form.querySelector(".form-error");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        error.hidden = true;
        const data = Object.fromEntries(new FormData(form));

        try {
          await api("/api/teacher/complaints", { method: "POST", body: data });
          m.close();
          toast("Complaint sent to the parent", "success");
          Portal.refresh();
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
        }
      });
    });
  }

  Portal.start({
    role: "TEACHER",
    title: "Teacher Portal",
    tabs: [
      { id: "home", label: "Overview", render: renderHome },
      { id: "homework", label: "Homework", render: renderHomework },
      { id: "resources", label: "Resources", render: renderResources },
      { id: "attendance", label: "Attendance", render: renderAttendance },
      { id: "complaints", label: "Complaints", render: renderComplaints },
    ],
  });
})();
