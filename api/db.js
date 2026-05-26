const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "users.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    totp_secret TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_totp_counter INTEGER
  )
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all().map((col) => col.name);
if (!userColumns.includes("last_used_totp_counter")) {
    db.exec("ALTER TABLE users ADD COLUMN last_used_totp_counter INTEGER");
}
if (!userColumns.includes("pdf_filename")) {
    db.exec("ALTER TABLE users ADD COLUMN pdf_filename TEXT");
}
if (!userColumns.includes("pdf_original_name")) {
    db.exec("ALTER TABLE users ADD COLUMN pdf_original_name TEXT");
}
if (!userColumns.includes("pdf_uploaded_at")) {
    db.exec("ALTER TABLE users ADD COLUMN pdf_uploaded_at TEXT");
}

module.exports = db;
