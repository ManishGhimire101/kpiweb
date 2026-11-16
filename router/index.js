const express = require("express");
const path = require("path");

const router = express.Router();

const publicPage = (file) => (req, res) =>
  res.sendFile(path.join(__dirname, "..", "public", file));

router.get("/", publicPage("index.html"));
router.get("/notice", publicPage("notice.html"));
router.get("/program", publicPage("program.html"));
router.get("/gallary", publicPage("gallary.html"));
router.get("/staff", publicPage("staff.html"));
router.get("/about", publicPage("about.html"));

module.exports = router;
