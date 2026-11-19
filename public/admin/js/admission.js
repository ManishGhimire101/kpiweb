let admissionModalInitialized = false;
let editingStudentId = null;


// =====================================================
// INITIALIZE NEW ADMISSION
// =====================================================

function initializeAdmissionModal() {

    if (admissionModalInitialized) {
        return;
    }

    const modal =
        document.getElementById("admissionModal");

    const openButton =
        document.getElementById("openAdmissionButton");

    const closeButton =
        document.getElementById("closeAdmissionButton");

    const cancelButton =
        document.getElementById("cancelAdmissionButton");

    const overlay =
        modal?.querySelector(
            ".admission-modal-overlay"
        );

    const form =
        document.getElementById("admissionForm");


    if (
        !modal ||
        !openButton ||
        !closeButton ||
        !cancelButton ||
        !overlay ||
        !form
    ) {

        console.error(
            "New Admission modal elements not found"
        );

        return;
    }


    admissionModalInitialized = true;

    loadAdmissionPrograms();
    document.getElementById("admissionProgram")?.addEventListener("change", (event) => {
        populateAdmissionCourses(event.target.value);
    });


    openButton.addEventListener(
        "click",
        openAdmissionModal
    );


    closeButton.addEventListener(
        "click",
        closeAdmissionModal
    );


    cancelButton.addEventListener(
        "click",
        closeAdmissionModal
    );


    overlay.addEventListener(
        "click",
        closeAdmissionModal
    );


    form.addEventListener(
        "submit",
        submitAdmission
    );


    // Escape key

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                modal.style.display !== "none"
            ) {
                closeAdmissionModal();
            }

        }
    );
}


// =====================================================
// OPEN MODAL
// =====================================================

let admissionPrograms = [];

async function loadAdmissionPrograms() {
    const programSelect = document.getElementById("admissionProgram");
    if (!programSelect) return;
    try {
        const response = await fetch("/api/admin/fees/catalog", { headers: { Authorization: `Bearer ${getAdminToken()}` } });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Unable to load programs");
        admissionPrograms = result.data.programs || [];
        programSelect.innerHTML = '<option value="">No program selected</option>' + admissionPrograms.map((program) => `<option value="${program.id}">${escapeAdmissionText(program.name)}</option>`).join("");
    } catch (error) {
        console.error("Admission program list failed:", error);
    }
}

function populateAdmissionCourses(programId, selectedCourseId = "") {
    const courseSelect = document.getElementById("admissionCourse");
    if (!courseSelect) return;
    const program = admissionPrograms.find((item) => String(item.id) === String(programId));
    const courses = program?.courses || [];
    courseSelect.innerHTML = '<option value="">No course selected</option>' + courses.map((course) => `<option value="${course.id}">${escapeAdmissionText(course.title)}</option>`).join("");
    courseSelect.disabled = !program;
    courseSelect.value = String(selectedCourseId || "");
}

function escapeAdmissionText(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function openAdmissionModal() {

    const modal =
        document.getElementById(
            "admissionModal"
        );

    if (!modal) {
        return;
    }


    modal.style.display = "block";
    editingStudentId = null;
    document.getElementById("admissionModalTitle").textContent = "New Admission";

    document.body.style.overflow =
        "hidden";


    const admissionDate =
        document.getElementById(
            "admissionDate"
        );


    if (
        admissionDate &&
        !admissionDate.value
    ) {

        const today =
            new Date()
                .toISOString()
                .split("T")[0];

        admissionDate.value = today;
    }
}


// =====================================================
// CLOSE MODAL
// =====================================================

function closeAdmissionModal() {

    const modal =
        document.getElementById(
            "admissionModal"
        );

    if (!modal) {
        return;
    }


    modal.style.display = "none";

    document.body.style.overflow =
        "";


    const form =
        document.getElementById(
            "admissionForm"
        );

    if (form) {
        form.reset();
    }

    editingStudentId = null;
    const title = document.getElementById("admissionModalTitle");
    if (title) title.textContent = "New Admission";


    const error =
        document.getElementById(
            "admissionError"
        );

    if (error) {
        error.style.display = "none";
        error.textContent = "";
    }
}


// =====================================================
// SUBMIT ADMISSION
// =====================================================

async function submitAdmission(event) {

    event.preventDefault();


    const button =
        document.getElementById(
            "createAdmissionButton"
        );

    const errorBox =
        document.getElementById(
            "admissionError"
        );


    errorBox.style.display = "none";
    errorBox.textContent = "";


    button.disabled = true;
    button.textContent =
        "Creating Admission...";


    try {

        const token =
            getAdminToken();


        if (!token) {

            adminLogout();

            return;
        }


        const payload = {

            student: {

                firstName:
                    document.getElementById(
                        "studentFirstName"
                    ).value.trim(),

                lastName:
                    document.getElementById(
                        "studentLastName"
                    ).value.trim(),

                dob:
                    document.getElementById(
                        "studentDob"
                    ).value || null,

                gender:
                    document.getElementById(
                        "studentGender"
                    ).value || null,

                phone:
                    document.getElementById(
                        "studentPhone"
                    ).value.trim(),

                address:
                    document.getElementById(
                        "studentAddress"
                    ).value.trim(),

                admissionDate:
                    document.getElementById(
                        "admissionDate"
                    ).value || null,

                status:
                    document.getElementById(
                        "studentStatus"
                    ).value,

                programId: document.getElementById("admissionProgram").value || null,

                courseId: document.getElementById("admissionCourse").value || null
            },


            parent: {

                firstName:
                    document.getElementById(
                        "parentFirstName"
                    ).value.trim(),

                lastName:
                    document.getElementById(
                        "parentLastName"
                    ).value.trim(),

                email:
                    document.getElementById(
                        "parentEmail"
                    ).value.trim(),

                phone:
                    document.getElementById(
                        "parentPhone"
                    ).value.trim(),

                address:
                    document.getElementById(
                        "parentAddress"
                    ).value.trim(),

                occupation:
                    document.getElementById(
                        "parentOccupation"
                    ).value.trim(),

                relationship:
                    document.getElementById(
                        "parentRelationship"
                    ).value || null
            }

        };


        const formData = new FormData();
        formData.append("student", JSON.stringify(payload.student));
        formData.append("parent", JSON.stringify(payload.parent));
        const photo = document.getElementById("studentPhoto")?.files[0];
        if (photo) formData.append("studentPhoto", photo);

        const isEditing = Boolean(editingStudentId);
        const response =
            await fetch(
                isEditing ? `/api/admin/students/${editingStudentId}` : "/api/admin/students/admission",
                {
                    method: isEditing ? "PUT" : "POST",

                    headers: isEditing ? {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    } : { "Authorization": `Bearer ${token}` },

                    body: isEditing ? JSON.stringify({ ...payload.student, accountStatus: true }) : formData
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            if (response.status === 401) {
                adminLogout();
                return;
            }

            throw new Error(
                result.message ||
                "Failed to create admission"
            );
        }


        console.log(
            "Admission created:",
            result
        );


        closeAdmissionModal();


        // Refresh student list

        if (
            typeof loadStudents ===
            "function"
        ) {
            await loadStudents();
        }


        // Show generated credentials

        showAdmissionSuccess(
            result.data
        );


    } catch (error) {

        console.error(
            "Admission error:",
            error
        );


        errorBox.textContent =
            error.message ||
            "Failed to create admission";


        errorBox.style.display =
            "block";


    } finally {

        button.disabled = false;

        button.textContent =
            "Create Admission";
    }
}


// =====================================================
// SUCCESS
// =====================================================

function showAdmissionSuccess(data) {

    const student =
        data.student;

    const parent =
        data.parent;


    alert(
        `Admission created successfully!\n\n` +

        `Student Code: ${student.studentCode}\n` +
        `Student Username: ${student.username}\n` +
        `Student Temporary Password: ${student.temporaryPassword}\n\n` +

        (parent.existing
            ? `Linked to existing parent account: ${parent.username} (${parent.email})\n` +
              `The parent signs in with their current password.`
            : `Parent Username: ${parent.username}\n` +
              `Parent Email: ${parent.email}\n` +
              `Parent Temporary Password: ${parent.temporaryPassword}`)
    );
}