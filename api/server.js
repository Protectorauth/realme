const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const db = require("./db");
const { generateSecret, getCurrentCode, getTotpCounter, isValidCodeFormat, verifyCode, secondsUntilNextCode } = require("./totp");

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const rootDir = path.join(__dirname, "..");
const uploadsDir = path.join(rootDir, "data", "uploads");
const MAX_PDF_SIZE = 10 * 1024 * 1024;

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const pdfStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, "user-" + req.params.id + "-" + Date.now() + ".pdf");
    }
});

const pdfUpload = multer({
    storage: pdfStorage,
    limits: { fileSize: MAX_PDF_SIZE },
    fileFilter: function (req, file, cb) {
        const isPdf =
            file.mimetype === "application/pdf" ||
            file.originalname.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
            return cb(new Error("Only PDF files are allowed."));
        }
        cb(null, true);
    }
});

function removeStoredPdf(filename) {
    if (!filename) {
        return;
    }
    const storedPath = path.join(uploadsDir, path.basename(filename));
    if (fs.existsSync(storedPath)) {
        fs.unlinkSync(storedPath);
    }
}

function ensureDefaultUser() {
    const username = process.env.DEFAULT_USERNAME;
    const password = process.env.DEFAULT_PASSWORD;
    if (!username || !password) {
        return;
    }
    const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
    if (existing) {
        return;
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const totpSecret = generateSecret();
    db.prepare(
        "INSERT INTO users (username, password_hash, totp_secret) VALUES (?, ?, ?)"
    ).run(username, passwordHash, totpSecret);
    console.log("Default user initialized.");
}

ensureDefaultUser();

app.use(express.json());
app.use(cookieParser());

app.get("/login", (req, res) => res.redirect("/login.html"));
app.get("/admin", (req, res) => res.redirect("/admin-panel/"));
app.get("/login-auth-code.html", (req, res) => res.redirect("/enter-realme-code.html"));
app.get("/identity-application", (req, res) => res.redirect("/identity-application.html"));

app.use("/admin-panel", express.static(path.join(rootDir, "admin-panel")));
app.use(express.static(rootDir));

function signAdminToken() {
    return jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "8h" });
}

function signUserToken(username) {
    return jwt.sign({ role: "user", username }, JWT_SECRET, { expiresIn: "15m" });
}

function requireAdmin(req, res, next) {
    const token = req.cookies.admin_token || (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) {
        return res.status(401).json({ error: "Admin login required." });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role !== "admin") {
            return res.status(403).json({ error: "Forbidden." });
        }
        next();
    } catch {
        return res.status(401).json({ error: "Session expired. Log in again." });
    }
}

function requireAuthenticatedUser(req, res, next) {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) {
        return res.status(401).json({ error: "Login required." });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role !== "authenticated" || !payload.username) {
            return res.status(403).json({ error: "Forbidden." });
        }
        req.authUser = payload;
        next();
    } catch {
        return res.status(401).json({ error: "Session expired. Log in again." });
    }
}

app.post("/api/admin/login", (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();
    if (
        username.toLowerCase() !== ADMIN_USERNAME.toLowerCase() ||
        password !== ADMIN_PASSWORD
    ) {
        return res.status(401).json({ error: "Invalid admin credentials." });
    }
    const token = signAdminToken();
    res.cookie("admin_token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000
    });
    res.json({ ok: true, token });
});

app.post("/api/admin/logout", (req, res) => {
    res.clearCookie("admin_token");
    res.json({ ok: true });
});

app.get("/api/admin/session", requireAdmin, (req, res) => {
    res.json({ ok: true, username: ADMIN_USERNAME });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
    const rows = db.prepare(
        "SELECT id, username, totp_secret, created_at, pdf_filename, pdf_original_name, pdf_uploaded_at FROM users ORDER BY id DESC"
    ).all();
    const users = rows.map((row) => ({
        id: row.id,
        username: row.username,
        created_at: row.created_at,
        auth_code: getCurrentCode(row.totp_secret),
        seconds_left: secondsUntilNextCode(),
        pdf_filename: row.pdf_filename,
        pdf_original_name: row.pdf_original_name,
        pdf_uploaded_at: row.pdf_uploaded_at,
        has_pdf: Boolean(row.pdf_filename)
    }));
    res.json({ users, seconds_left: secondsUntilNextCode() });
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || username.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters." });
    }
    if (!password || password.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters." });
    }

    const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
    if (existing) {
        return res.status(409).json({ error: "Username already exists." });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const totpSecret = generateSecret();

    const result = db.prepare(
        "INSERT INTO users (username, password_hash, totp_secret) VALUES (?, ?, ?)"
    ).run(username, passwordHash, totpSecret);

    res.status(201).json({
        id: result.lastInsertRowid,
        username,
        auth_code: getCurrentCode(totpSecret),
        seconds_left: secondsUntilNextCode()
    });
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const user = db.prepare("SELECT pdf_filename FROM users WHERE id = ?").get(id);
    if (!user) {
        return res.status(404).json({ error: "User not found." });
    }
    removeStoredPdf(user.pdf_filename);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ ok: true });
});

app.post("/api/admin/users/:id/pdf", requireAdmin, function (req, res) {
    pdfUpload.single("pdf")(req, res, function (err) {
        if (err) {
            const message =
                err.code === "LIMIT_FILE_SIZE"
                    ? "PDF must be 10 MB or smaller."
                    : err.message || "Could not upload PDF.";
            return res.status(400).json({ error: message });
        }

        const id = Number(req.params.id);
        const user = db.prepare("SELECT id, pdf_filename FROM users WHERE id = ?").get(id);
        if (!user) {
            if (req.file) {
                removeStoredPdf(req.file.filename);
            }
            return res.status(404).json({ error: "User not found." });
        }
        if (!req.file) {
            return res.status(400).json({ error: "Choose a PDF file to upload." });
        }

        removeStoredPdf(user.pdf_filename);
        db.prepare(
            "UPDATE users SET pdf_filename = ?, pdf_original_name = ?, pdf_uploaded_at = datetime('now') WHERE id = ?"
        ).run(req.file.filename, req.file.originalname, id);

        res.json({
            ok: true,
            pdf_filename: req.file.filename,
            pdf_original_name: req.file.originalname
        });
    });
});

app.get("/api/admin/users/:id/pdf", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const user = db.prepare("SELECT pdf_filename, pdf_original_name FROM users WHERE id = ?").get(id);
    if (!user || !user.pdf_filename) {
        return res.status(404).json({ error: "No PDF uploaded for this user." });
    }

    const filePath = path.join(uploadsDir, path.basename(user.pdf_filename));
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "PDF file not found." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
        "Content-Disposition",
        'inline; filename="' + (user.pdf_original_name || "document.pdf").replace(/"/g, "") + '"'
    );
    res.sendFile(filePath);
});

app.delete("/api/admin/users/:id/pdf", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const user = db.prepare("SELECT pdf_filename FROM users WHERE id = ?").get(id);
    if (!user) {
        return res.status(404).json({ error: "User not found." });
    }
    if (!user.pdf_filename) {
        return res.status(404).json({ error: "No PDF uploaded for this user." });
    }

    removeStoredPdf(user.pdf_filename);
    db.prepare(
        "UPDATE users SET pdf_filename = NULL, pdf_original_name = NULL, pdf_uploaded_at = NULL WHERE id = ?"
    ).run(id);
    res.json({ ok: true });
});

app.post("/api/auth/login", (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid username or password." });
    }

    const pendingToken = signUserToken(user.username);
    res.json({
        ok: true,
        pending_token: pendingToken,
        username: user.username
    });
});

app.post("/api/auth/verify-code", (req, res) => {
    const code = String(req.body?.code || "").trim();
    const pendingToken = req.body?.pending_token || req.headers.authorization?.replace("Bearer ", "");

    if (!pendingToken || !code) {
        return res.status(400).json({ error: "Authentication code required." });
    }

    if (!isValidCodeFormat(code)) {
        return res.status(401).json({ error: "The confirmation code is invalid." });
    }

    let payload;
    try {
        payload = jwt.verify(pendingToken, JWT_SECRET);
    } catch {
        return res.status(401).json({ error: "Session expired. Log in again." });
    }

    if (payload.role !== "user" || !payload.username) {
        return res.status(403).json({ error: "Invalid session." });
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(payload.username);
    if (!user) {
        return res.status(404).json({ error: "User not found." });
    }

    const currentCounter = getTotpCounter();
    if (user.last_used_totp_counter === currentCounter) {
        return res.status(401).json({ error: "The confirmation code has already been used." });
    }

    if (!verifyCode(user.totp_secret, code)) {
        return res.status(401).json({ error: "The confirmation code is invalid." });
    }

    db.prepare("UPDATE users SET last_used_totp_counter = ? WHERE id = ?").run(currentCounter, user.id);

    const sessionToken = jwt.sign(
        { role: "authenticated", username: user.username },
        JWT_SECRET,
        { expiresIn: "2h" }
    );

    res.json({ ok: true, session_token: sessionToken, username: user.username });
});

app.get("/api/auth/time", (req, res) => {
    res.json({ seconds_left: secondsUntilNextCode() });
});

app.get("/api/user/consent-pdf", requireAuthenticatedUser, (req, res) => {
    const user = db.prepare(
        "SELECT pdf_filename, pdf_original_name FROM users WHERE username = ? COLLATE NOCASE"
    ).get(req.authUser.username);
    if (!user || !user.pdf_filename) {
        return res.status(404).json({ error: "No document available." });
    }

    const filePath = path.join(uploadsDir, path.basename(user.pdf_filename));
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Document not found." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.sendFile(filePath);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`RealMe site: http://localhost:${PORT}/login.html`);
    console.log(`Admin panel: http://localhost:${PORT}/admin-panel/`);
});
