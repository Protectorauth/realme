const fs = require("fs");
const path = require("path");

const base = process.env.REALME_API_BASE || "";
const target = path.join(__dirname, "..", "assets", "realme-env.js");
const content = "window.REALME_API_BASE = " + JSON.stringify(base) + ";\n";

fs.writeFileSync(target, content, "utf8");
console.log("Configured API base:", base || "(same origin)");
