
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config();

const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || "softmanager_dev_secret_key_998877",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// Serve static frontend assets
app.use("/html", express.static(path.join(__dirname, "html")));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));

// Root redirect to login
app.get("/", (req, res) => {
    res.redirect("/html/index.html");
});

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    next();
}

// Check active session
app.get("/api/auth/session", (req, res) => {
    if (req.session && req.session.user) {
        return res.json({ username: req.session.user.username });
    }
    return res.status(401).json({ error: "No active session" });
});

// Login
app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }

    try {
        const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
        let user = rows[0];

        if (!user) {
            const hash = await bcrypt.hash(password, 10);
            const [result] = await db.query(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                [username, hash]
            );
            user = { id: result.insertId, username, password_hash: hash };
        } else {
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
        }

        req.session.user = { id: user.id, username: user.username };
        res.json({ success: true, username: user.username });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Server error during login" });
    }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// Test API status
app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "Soft Manager Backend is Running!"
    });
});

// Migrate / bulk-sync data for data-store.js
app.post("/api/data/migrate", requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const { records = {} } = req.body;

    try {
        const [rows] = await db.query("SELECT data_key, data_value FROM app_data WHERE username = ?", [username]);
        const serverRecords = {};
        for (const row of rows) {
            serverRecords[row.data_key] = row.data_value;
        }

        for (const [key, value] of Object.entries(records)) {
            if (!(key in serverRecords)) {
                await db.query(
                    `INSERT INTO app_data (username, data_key, data_value) 
                     VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE data_value = VALUES(data_value)`,
                    [username, key, value]
                );
                serverRecords[key] = value;
            }
        }

        res.json({ imported: true, records: serverRecords });
    } catch (err) {
        console.error("Migrate error:", err);
        res.status(500).json({ error: err.message, code: "MYSQL_STORAGE_UNAVAILABLE" });
    }
});

// Store single key
app.put("/api/data", requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const key = req.query.key;
    const { value } = req.body;

    if (!key) return res.status(400).json({ error: "Missing key parameter" });

    try {
        await db.query(
            `INSERT INTO app_data (username, data_key, data_value) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE data_value = VALUES(data_value)`,
            [username, key, value]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Save error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Delete single key
app.delete("/api/data", requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const key = req.query.key;

    if (!key) return res.status(400).json({ error: "Missing key parameter" });

    try {
        await db.query("DELETE FROM app_data WHERE username = ? AND data_key = ?", [username, key]);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});