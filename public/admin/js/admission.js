let admissionModalInitialized = false;


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

function openAdmissionModal() {

    const modal =
        document.getElementById(
            "admissionModal"
        );

    if (!modal) {
        return;
    }


    modal.style.display = "block";

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
                    ).value
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


        const response =
            await fetch(
                "/api/admin/students/admission",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify(payload)
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

        `Parent Username: ${parent.username}\n` +
        `Parent Email: ${parent.email}\n` +
        `Parent Temporary Password: ${parent.temporaryPassword}`
    );
}