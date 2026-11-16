(function () {
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  async function api(path, options = {}) {
    const headers = { Authorization: `Bearer ${getAdminToken()}` };
    let body;

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const response = await fetch(path, { method: options.method || "GET", headers, body });
    let data = {};

    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (response.status === 401) {
      adminLogout();
      throw new Error("Session expired");
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  function toast(message, type) {
    const el = document.createElement("div");
    el.className = `lms-toast ${type || ""}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function modal(html, wide) {
    const backdrop = document.createElement("div");
    backdrop.className = "lms-backdrop";
    backdrop.innerHTML = `<div class="lms-modal ${wide ? "wide" : ""}">${html}</div>`;
    document.body.appendChild(backdrop);

    const api = { el: backdrop.firstElementChild, close: () => backdrop.remove() };

    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) api.close();
    });
    backdrop.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", api.close));

    return api;
  }

  function credentials(title, creds) {
    const m = modal(`<h3>${esc(title)}</h3>
      <p class="lms-muted">Share these details with the user. The password is shown only once and must be changed on first sign-in.</p>
      <div class="lms-cred">Username: ${esc(creds.username)}<br>Temporary password: ${esc(creds.temporaryPassword)}</div>
      <div class="lms-actions"><button class="lms-btn secondary" data-copy>Copy</button><button class="lms-btn" data-close>Done</button></div>`);

    m.el.querySelector("[data-copy]").addEventListener("click", () => {
      navigator.clipboard
        .writeText(`Username: ${creds.username}\nPassword: ${creds.temporaryPassword}`)
        .then(() => toast("Copied", "success"))
        .catch(() => toast("Copy failed", "error"));
    });
  }

  async function resetPassword(userId, name) {
    if (!confirm(`Reset the password for ${name}? Their current password will stop working.`)) return;

    try {
      const result = await api(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      credentials(`New password for ${name}`, result.data);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  window.initializeTeachers = async function initializeTeachers() {
    const table = document.getElementById("teachersTable");
    const addBtn = document.getElementById("addTeacherBtn");

    async function draw() {
      try {
        const teachers = (await api("/api/admin/teachers")).data;

        table.innerHTML = teachers.length
          ? `<table class="lms-table"><thead><tr><th>Teacher</th><th>Username</th><th>Contact</th><th>Classes</th><th>Status</th><th></th></tr></thead><tbody>
            ${teachers
              .map(
                (t) => `<tr><td><strong>${esc(t.name)}</strong><div class="lms-muted">${esc(t.designation || "")}</div></td>
              <td>${esc(t.username)}</td><td>${esc(t.email || "")}<div class="lms-muted">${esc(t.phone || "")}</div></td>
              <td>${t.classes.length ? t.classes.map((c) => `<span class="lms-chip">${esc(c.label)}${c.subject ? ` - ${esc(c.subject)}` : ""}</span>`).join("") : '<span class="lms-muted">Not assigned</span>'}</td>
              <td><span class="lms-badge ${t.isActive ? "ok" : "bad"}">${t.isActive ? "Active" : "Disabled"}</span></td>
              <td style="white-space:nowrap"><button class="lms-btn small secondary" data-reset="${t.id}">Reset password</button>
              <button class="lms-btn small ${t.isActive ? "danger" : "secondary"}" data-toggle="${t.id}">${t.isActive ? "Disable" : "Enable"}</button></td></tr>`,
              )
              .join("")}</tbody></table>`
          : '<div class="lms-empty">No teachers yet. Add your first teacher.</div>';

        const find = (id) => teachers.find((t) => String(t.id) === String(id));

        table.querySelectorAll("[data-reset]").forEach((b) =>
          b.addEventListener("click", () => {
            const teacher = find(b.dataset.reset);
            resetPassword(teacher.userId, teacher.name);
          }),
        );

        table.querySelectorAll("[data-toggle]").forEach((b) =>
          b.addEventListener("click", async () => {
            const teacher = find(b.dataset.toggle);

            try {
              await api(`/api/admin/users/${teacher.userId}/status`, { method: "PATCH", body: { isActive: !teacher.isActive } });
              toast(teacher.isActive ? "Account disabled" : "Account enabled", "success");
              draw();
            } catch (error) {
              toast(error.message, "error");
            }
          }),
        );
      } catch (error) {
        table.innerHTML = `<div class="lms-empty">${esc(error.message)}</div>`;
      }
    }

    addBtn.addEventListener("click", () => {
      const m = modal(`<h3>Add teacher</h3>
        <form>
          <div class="lms-error" hidden></div>
          <div class="lms-row">
            <div class="lms-field"><label>First name *</label><input name="firstName" required maxlength="80"></div>
            <div class="lms-field"><label>Last name</label><input name="lastName" maxlength="80"></div>
          </div>
          <div class="lms-row">
            <div class="lms-field"><label>Email</label><input type="email" name="email"></div>
            <div class="lms-field"><label>Phone</label><input name="phone" pattern="[0-9+\\-\\s()]{6,20}" title="Enter a valid phone number"></div>
          </div>
          <div class="lms-field"><label>Designation</label><input name="designation" placeholder="e.g. Mathematics Teacher"></div>
          <div class="lms-actions"><button type="button" class="lms-btn secondary" data-close>Cancel</button><button class="lms-btn" type="submit">Create teacher</button></div>
        </form>`);

      const form = m.el.querySelector("form");
      const error = form.querySelector(".lms-error");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        error.hidden = true;

        try {
          const result = await api("/api/admin/teachers", { method: "POST", body: Object.fromEntries(new FormData(form)) });
          m.close();
          credentials(`Teacher created: ${result.data.name}`, result.data);
          draw();
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
        }
      });
    });

    draw();
  };

  window.initializeParents = async function initializeParents() {
    const table = document.getElementById("parentsTable");
    const search = document.getElementById("parentsSearch");
    let parents = [];

    function render() {
      const q = (search.value || "").trim().toLowerCase();
      const list = q
        ? parents.filter((p) =>
            [p.name, p.username, p.email, p.phone, ...p.children.map((c) => `${c.name} ${c.studentCode}`)]
              .join(" ")
              .toLowerCase()
              .includes(q),
          )
        : parents;

      if (!parents.length) {
        table.innerHTML = '<div class="lms-empty">No parents yet. Parents are added when you create a new admission on the Students page.</div>';
        return;
      }

      if (!list.length) {
        table.innerHTML = '<div class="lms-empty">No parents match your search.</div>';
        return;
      }

      table.innerHTML = `<table class="lms-table"><thead><tr><th>Parent</th><th>Username</th><th>Contact</th><th>Children</th><th>Status</th><th></th></tr></thead><tbody>
        ${list
          .map(
            (p) => `<tr><td><strong>${esc(p.name)}</strong><div class="lms-muted">${esc(p.occupation || "")}</div></td>
          <td>${esc(p.username)}${p.mustChangePassword ? '<div class="lms-muted">Not signed in yet</div>' : ""}</td>
          <td>${esc(p.email || "")}<div class="lms-muted">${esc(p.phone || "")}</div></td>
          <td>${p.children.length ? p.children.map((c) => `<span class="lms-chip">${esc(c.name)} (${esc(c.studentCode)})${c.classLabel ? ` - ${esc(c.classLabel)}` : ""}${c.relationship ? ` · ${esc(c.relationship)}` : ""}</span>`).join("") : '<span class="lms-muted">No children linked</span>'}</td>
          <td><span class="lms-badge ${p.isActive ? "ok" : "bad"}">${p.isActive ? "Active" : "Disabled"}</span></td>
          <td style="white-space:nowrap"><button class="lms-btn small secondary" data-reset="${p.id}">Reset password</button>
          <button class="lms-btn small ${p.isActive ? "danger" : "secondary"}" data-toggle="${p.id}">${p.isActive ? "Disable" : "Enable"}</button></td></tr>`,
          )
          .join("")}</tbody></table>`;

      const find = (id) => parents.find((p) => String(p.id) === String(id));

      table.querySelectorAll("[data-reset]").forEach((b) =>
        b.addEventListener("click", () => {
          const parent = find(b.dataset.reset);
          resetPassword(parent.userId, parent.name);
        }),
      );

      table.querySelectorAll("[data-toggle]").forEach((b) =>
        b.addEventListener("click", async () => {
          const parent = find(b.dataset.toggle);

          try {
            await api(`/api/admin/users/${parent.userId}/status`, { method: "PATCH", body: { isActive: !parent.isActive } });
            toast(parent.isActive ? "Account disabled" : "Account enabled", "success");
            load();
          } catch (error) {
            toast(error.message, "error");
          }
        }),
      );
    }

    async function load() {
      try {
        parents = (await api("/api/admin/parents")).data;
        render();
      } catch (error) {
        table.innerHTML = `<div class="lms-empty">${esc(error.message)}</div>`;
      }
    }

    search.addEventListener("input", render);
    table.innerHTML = '<div class="lms-empty">Loading...</div>';
    load();
  };

  window.initializeClasses = async function initializeClasses() {
    const grid = document.getElementById("classesGrid");
    const addBtn = document.getElementById("addClassBtn");

    async function draw() {
      try {
        const classes = (await api("/api/admin/classes")).data;

        grid.innerHTML = classes.length
          ? classes
              .map(
                (c) => `<div class="lms-card"><h3>${esc(c.label)}</h3>
            <div class="lms-muted">${c.studentCount} student(s)${c.academicYear ? ` &middot; ${esc(c.academicYear)}` : ""}</div>
            <div style="margin:8px 0">${c.teachers.length ? c.teachers.map((t) => `<span class="lms-chip">${esc(t.name)}${t.subject ? ` - ${esc(t.subject)}` : ""}</span>`).join("") : '<span class="lms-muted">No teacher assigned</span>'}</div>
            <button class="lms-btn small" data-manage="${c.id}">Manage</button></div>`,
              )
              .join("")
          : '<div class="lms-empty" style="grid-column:1/-1">No classes yet. Create a class to start.</div>';

        grid.querySelectorAll("[data-manage]").forEach((b) => b.addEventListener("click", () => manage(b.dataset.manage, draw)));
      } catch (error) {
        grid.innerHTML = `<div class="lms-empty" style="grid-column:1/-1">${esc(error.message)}</div>`;
      }
    }

    addBtn.addEventListener("click", () => classForm(null, draw));

    draw();
  };

  function classForm(cls, onDone) {
    const m = modal(`<h3>${cls ? "Edit class" : "New class"}</h3>
      <form>
        <div class="lms-error" hidden></div>
        <div class="lms-row">
          <div class="lms-field"><label>Class name *</label><input name="name" required maxlength="50" placeholder="Grade 5" value="${esc(cls ? cls.name : "")}"></div>
          <div class="lms-field"><label>Section</label><input name="section" maxlength="20" placeholder="A" value="${esc(cls ? cls.section : "")}"></div>
        </div>
        <div class="lms-field"><label>Academic year</label><input name="academicYear" maxlength="20" placeholder="2026" value="${esc(cls && cls.academicYear ? cls.academicYear : "")}"></div>
        <div class="lms-actions"><button type="button" class="lms-btn secondary" data-close>Cancel</button><button class="lms-btn" type="submit">${cls ? "Save" : "Create class"}</button></div>
      </form>`);

    const form = m.el.querySelector("form");
    const error = form.querySelector(".lms-error");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;

      try {
        await api(cls ? `/api/admin/classes/${cls.id}` : "/api/admin/classes", {
          method: cls ? "PUT" : "POST",
          body: Object.fromEntries(new FormData(form)),
        });
        m.close();
        toast(cls ? "Class updated" : "Class created", "success");
        onDone();
      } catch (err) {
        error.textContent = /already exists/.test(err.message)
          ? "A class with this name and section already exists"
          : err.message;
        error.hidden = false;
      }
    });
  }

  async function manage(classId, onChange) {
    const m = modal('<div class="lms-muted">Loading...</div>', true);

    async function draw() {
      const [classes, inClass, allStudents, teachers] = await Promise.all([
        api("/api/admin/classes").then((r) => r.data),
        api(`/api/admin/classes/${classId}/students`).then((r) => r.data),
        api("/api/admin/lms/students").then((r) => r.data),
        api("/api/admin/teachers").then((r) => r.data),
      ]);

      const cls = classes.find((c) => String(c.id) === String(classId));
      const available = allStudents.filter((s) => String(s.classId) !== String(classId));

      m.el.innerHTML = `<h3>${esc(cls.label)}</h3>
        <div class="lms-actions" style="justify-content:flex-start;margin:0 0 6px">
          <button class="lms-btn small secondary" data-edit>Rename</button>
          <button class="lms-btn small danger" data-delete>Delete class</button>
        </div>

        <h4>Teachers</h4>
        ${cls.teachers.length ? cls.teachers.map((t) => `<span class="lms-chip">${esc(t.name)}${t.subject ? ` - ${esc(t.subject)}` : ""} <a href="#" data-unassign="${t.assignmentId}" style="color:#b91c1c;text-decoration:none">&times;</a></span>`).join("") : '<div class="lms-muted">No teachers assigned.</div>'}
        <form data-teacher-form class="lms-row" style="margin-top:8px;align-items:end">
          <div class="lms-field" style="margin:0"><label>Teacher</label><select name="teacherId" required><option value="">Select</option>${teachers.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>
          <div class="lms-field" style="margin:0"><label>Subject</label><input name="subject" maxlength="80" placeholder="Mathematics"></div>
          <div><button class="lms-btn" type="submit">Assign</button></div>
        </form>

        <h4>Students (${inClass.length})</h4>
        ${
          inClass.length
            ? `<div class="lms-table-wrap"><table class="lms-table"><thead><tr><th>Student</th><th>Roll no.</th><th>Passwords</th><th></th></tr></thead><tbody>
          ${inClass
            .map(
              (s) => `<tr><td><strong>${esc(s.name)}</strong><div class="lms-muted">${esc(s.studentCode)}</div></td>
            <td><input data-roll="${s.id}" value="${esc(s.rollNo || "")}" maxlength="20" style="width:80px;padding:5px;border:1px solid #cbd5e1;border-radius:6px"></td>
            <td style="white-space:nowrap"><button class="lms-btn small secondary" data-reset-user="${s.userId}" data-name="${esc(s.name)}">Student</button>
            ${s.parents.map((p) => `<button class="lms-btn small secondary" data-reset-user="${p.userId}" data-name="${esc(p.name)}">Parent</button>`).join(" ")}</td>
            <td><button class="lms-btn small danger" data-remove="${s.id}">Remove</button></td></tr>`,
            )
            .join("")}</tbody></table></div>`
            : '<div class="lms-muted">No students in this class yet.</div>'
        }

        <h4>Add students</h4>
        ${
          available.length
            ? `<form data-add-students><div class="lms-student-list">${available
                .map((s) => `<label><input type="checkbox" value="${s.id}"> ${esc(s.name)} <span class="lms-muted">${esc(s.studentCode)}${s.classLabel ? ` &middot; now in ${esc(s.classLabel)}` : ""}</span></label>`)
                .join("")}</div>
              <div class="lms-actions"><button class="lms-btn" type="submit">Add selected</button></div></form>`
            : '<div class="lms-muted">All students are already in this class (or there are no students yet). Admit students from the Students page.</div>'
        }
        <div class="lms-actions"><button class="lms-btn secondary" data-close>Close</button></div>`;

      m.el.querySelector("[data-close]").addEventListener("click", () => {
        m.close();
        onChange();
      });

      m.el.querySelector("[data-edit]").addEventListener("click", () => {
        m.close();
        classForm(cls, onChange);
      });

      m.el.querySelector("[data-delete]").addEventListener("click", async () => {
        if (!confirm(`Delete ${cls.label}? Homework, resources and attendance for this class will be deleted too. Students are kept but will have no class.`)) return;

        try {
          await api(`/api/admin/classes/${classId}`, { method: "DELETE" });
          m.close();
          toast("Class deleted", "success");
          onChange();
        } catch (error) {
          toast(error.message, "error");
        }
      });

      m.el.querySelector("[data-teacher-form]").addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
          await api(`/api/admin/classes/${classId}/teachers`, {
            method: "POST",
            body: Object.fromEntries(new FormData(event.target)),
          });
          toast("Teacher assigned", "success");
          draw();
        } catch (error) {
          toast(/already exists/.test(error.message) ? "This teacher is already assigned for that subject" : error.message, "error");
        }
      });

      m.el.querySelectorAll("[data-unassign]").forEach((a) =>
        a.addEventListener("click", async (event) => {
          event.preventDefault();

          try {
            await api(`/api/admin/classes/${classId}/teachers/${a.dataset.unassign}`, { method: "DELETE" });
            draw();
          } catch (error) {
            toast(error.message, "error");
          }
        }),
      );

      m.el.querySelectorAll("[data-roll]").forEach((input) =>
        input.addEventListener("change", async () => {
          try {
            await api(`/api/admin/classes/${classId}/students/${input.dataset.roll}`, {
              method: "PATCH",
              body: { rollNo: input.value },
            });
            toast("Roll number saved", "success");
          } catch (error) {
            toast(error.message, "error");
          }
        }),
      );

      m.el.querySelectorAll("[data-remove]").forEach((b) =>
        b.addEventListener("click", async () => {
          try {
            await api(`/api/admin/classes/${classId}/students/${b.dataset.remove}`, { method: "DELETE" });
            draw();
          } catch (error) {
            toast(error.message, "error");
          }
        }),
      );

      m.el.querySelectorAll("[data-reset-user]").forEach((b) =>
        b.addEventListener("click", () => resetPassword(b.dataset.resetUser, b.dataset.name)),
      );

      const addForm = m.el.querySelector("[data-add-students]");

      if (addForm) {
        addForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const ids = [...addForm.querySelectorAll("input:checked")].map((i) => Number(i.value));

          if (!ids.length) {
            toast("Select at least one student", "error");
            return;
          }

          try {
            await api(`/api/admin/classes/${classId}/students`, { method: "POST", body: { studentIds: ids } });
            toast(`${ids.length} student(s) added`, "success");
            draw();
          } catch (error) {
            toast(error.message, "error");
          }
        });
      }
    }

    try {
      await draw();
    } catch (error) {
      m.el.innerHTML = `<div class="lms-error">${esc(error.message)}</div><div class="lms-actions"><button class="lms-btn" data-close>Close</button></div>`;
      m.el.querySelector("[data-close]").addEventListener("click", m.close);
    }
  }
})();
