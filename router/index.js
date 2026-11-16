const express = require("express");
const path = require("path");

const router = express.Router();

// ================================
// PUBLIC HOME PAGE
// ================================

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ================================
// NOTICE
// ================================

router.get("/notice", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "notice.html"));
});

// ================================
// PROGRAM
// ================================

router.get("/program", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "program.html"));
});

// ================================
// GALLERY
// ================================

router.get("/gallary", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "gallary.html"));
});

// ================================
// STAFF
// ================================

router.get("/staff", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "staff.html"));
});

// ================================
// ABOUT
// ================================

router.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "about.html"));
});

//super admin loginroute
router.get("/superadmin", (req, res) =>{
  res.sendFile(path.join(__dirname,"..","public","superadmin.html"))
});
//for admin
router.get("/admin/login", (req, res) =>{
  res.sendFile(path.join(__dirname,"..","public","adminlogin.html"))
});
router.get("/admin/change-password",(req,res) =>{
  res.sendFile(path.join(__dirname,"..","public","admin","change-password.html"))
})

//superadmin dashbboard
router.get("/dashboard", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "..",
            "public",
            "super_admin",
            "index.html"
        )
    );
});
//admin login route
router.use("/admin", require("./api/admin"));

module.exports = router;