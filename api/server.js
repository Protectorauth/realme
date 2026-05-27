const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const users = require("./users");
const pdfStorage = require("./storage");
const loginBanner = require("./login-banner");
const { generateSecret, getCurrentCode, getTotpCounter, isValidCodeFormat, verifyCode, secondsUntilNextCode } = require("./totp");

const app = express();
const PORT = process.env.PORT || 8080;
const rootDir = path.join(__dirname, "..");
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SERVE_STATIC = process.env.SERVE_STATIC !== "false";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(function (value) {
        return value.trim();
    })
    .filter(Boolean);
const MAX_PDF_SIZE = 10 * 1024 * 1024;

const pdfUpload = multer({
    storage: multer.memoryStorage(),
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

async function ensureDefaultUser() {
    const username = process.env.DEFAULT_USERNAME;
    const password = process.env.DEFAULT_PASSWORD;
    if (!username || !password) {
        return;
    }

    const existing = await users.findByUsername(username);
    if (existing) {
        return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const totpSecret = generateSecret();
    await users.createUser(username, passwordHash, totpSecret);
    console.log("Default user initialized.");
}

function sendServerError(res, error) {
    console.error(error);
    res.status(500).json({ error: "Server error." });
}

ensureDefaultUser().catch(function (error) {
    console.error("Startup error:", error.message);
});

app.use(function (req, res, next) {
    var origin = req.headers.origin;
    if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.indexOf(origin) !== -1)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", async function (req, res) {
    try {
        await users.healthCheck();
        res.json({ ok: true, database: "supabase" });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.get("/api/public/login-banner", async function (req, res) {
    try {
        const banner = await loginBanner.getBanner();
        res.json({
            visible: banner.is_visible && Boolean(banner.message_html),
            html: banner.is_visible ? banner.message_html : ""
        });
    } catch (error) {
        sendServerError(res, error);
    }
});

if (SERVE_STATIC) {
    app.get("/login", (req, res) => res.redirect("/login.html"));
    app.get("/admin", (req, res) => res.redirect("/admin-panel/"));
    app.get("/login-auth-code.html", (req, res) => res.redirect("/enter-realme-code.html"));
    app.get("/identity-application", (req, res) => res.redirect("/identity-application.html"));

    app.use("/admin-panel", express.static(path.join(rootDir, "admin-panel")));
    app.use(express.static(rootDir));
}

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

app.get("/api/admin/login-banner", requireAdmin, async function (req, res) {
    try {
        const banner = await loginBanner.getBanner();
        res.json({
            visible: banner.is_visible,
            html: banner.message_html,
            updated_at: banner.updated_at
        });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.put("/api/admin/login-banner", requireAdmin, async function (req, res) {
    const visible = Boolean(req.body?.visible);
    const html = loginBanner.sanitizeBannerHtml(req.body?.html);

    if (visible && !html) {
        return res.status(400).json({ error: "Message is required when the warning is visible." });
    }

    try {
        const banner = await loginBanner.updateBanner(visible, html);
        res.json({
            ok: true,
            visible: banner.is_visible,
            html: banner.message_html,
            updated_at: banner.updated_at
        });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.get("/api/admin/users", requireAdmin, async function (req, res) {
    try {
        const rows = await users.listUsers();
        const mapped = rows.map(function (row) {
            return {
                id: row.id,
                username: row.username,
                created_at: row.created_at,
                auth_code: getCurrentCode(row.totp_secret),
                seconds_left: secondsUntilNextCode(),
                pdf_filename: row.pdf_filename,
                pdf_original_name: row.pdf_original_name,
                pdf_uploaded_at: row.pdf_uploaded_at,
                has_pdf: Boolean(row.pdf_filename)
            };
        });
        res.json({ users: mapped, seconds_left: secondsUntilNextCode() });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post("/api/admin/users", requireAdmin, async function (req, res) {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || username.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters." });
    }
    if (!password || password.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters." });
    }

    try {
        const existing = await users.findByUsername(username);
        if (existing) {
            return res.status(409).json({ error: "Username already exists." });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const totpSecret = generateSecret();
        const created = await users.createUser(username, passwordHash, totpSecret);

        res.status(201).json({
            id: created.id,
            username: created.username,
            auth_code: getCurrentCode(totpSecret),
            seconds_left: secondsUntilNextCode()
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Username already exists." });
        }
        sendServerError(res, error);
    }
});

app.delete("/api/admin/users/:id", requireAdmin, async function (req, res) {
    const id = Number(req.params.id);

    try {
        const user = await users.findById(id);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        await pdfStorage.deletePdf(user.pdf_filename);
        await users.deleteUser(id);
        res.json({ ok: true });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post("/api/admin/users/:id/pdf", requireAdmin, function (req, res) {
    pdfUpload.single("pdf")(req, res, async function (err) {
        if (err) {
            const message =
                err.code === "LIMIT_FILE_SIZE"
                    ? "PDF must be 10 MB or smaller."
                    : err.message || "Could not upload PDF.";
            return res.status(400).json({ error: message });
        }

        const id = Number(req.params.id);

        try {
            const user = await users.findById(id);
            if (!user) {
                return res.status(404).json({ error: "User not found." });
            }
            if (!req.file) {
                return res.status(400).json({ error: "Choose a PDF file to upload." });
            }

            const nextPath = pdfStorage.buildPdfPath(id);
            await pdfStorage.uploadPdf(nextPath, req.file.buffer, req.file.mimetype);
            await pdfStorage.deletePdf(user.pdf_filename);
            await users.updatePdfMeta(id, nextPath, req.file.originalname);

            res.json({
                ok: true,
                pdf_filename: nextPath,
                pdf_original_name: req.file.originalname
            });
        } catch (error) {
            sendServerError(res, error);
        }
    });
});

app.get("/api/admin/users/:id/pdf", requireAdmin, async function (req, res) {
    const id = Number(req.params.id);

    try {
        const user = await users.findById(id);
        if (!user || !user.pdf_filename) {
            return res.status(404).json({ error: "No PDF uploaded for this user." });
        }

        const blob = await pdfStorage.downloadPdf(user.pdf_filename);
        const buffer = Buffer.from(await blob.arrayBuffer());

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            'inline; filename="' + (user.pdf_original_name || "document.pdf").replace(/"/g, "") + '"'
        );
        res.send(buffer);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.delete("/api/admin/users/:id/pdf", requireAdmin, async function (req, res) {
    const id = Number(req.params.id);

    try {
        const user = await users.findById(id);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }
        if (!user.pdf_filename) {
            return res.status(404).json({ error: "No PDF uploaded for this user." });
        }

        await pdfStorage.deletePdf(user.pdf_filename);
        await users.clearPdfMeta(id);
        res.json({ ok: true });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post("/api/auth/login", async function (req, res) {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }

    try {
        const user = await users.findByUsername(username);
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        const pendingToken = signUserToken(user.username);
        res.json({
            ok: true,
            pending_token: pendingToken,
            username: user.username
        });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.post("/api/auth/verify-code", async function (req, res) {
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

    try {
        const user = await users.findByUsername(payload.username);
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

        await users.updateLastUsedCounter(user.id, currentCounter);

        const sessionToken = jwt.sign(
            { role: "authenticated", username: user.username },
            JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({ ok: true, session_token: sessionToken, username: user.username });
    } catch (error) {
        sendServerError(res, error);
    }
});

app.get("/api/auth/time", (req, res) => {
    res.json({ seconds_left: secondsUntilNextCode() });
});

app.get("/api/user/consent-pdf", requireAuthenticatedUser, async function (req, res) {
    try {
        const user = await users.findByUsername(req.authUser.username);
        if (!user || !user.pdf_filename) {
            return res.status(404).json({ error: "No document available." });
        }

        const blob = await pdfStorage.downloadPdf(user.pdf_filename);
        const buffer = Buffer.from(await blob.arrayBuffer());

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
        res.send(buffer);
    } catch (error) {
        sendServerError(res, error);
    }
});

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
    console.log("Database: Supabase");
    console.log("Static files: " + (SERVE_STATIC ? "enabled" : "disabled (API only)"));
});
