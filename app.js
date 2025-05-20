// app.js
import express from "express";
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import session from "express-session";
import bcrypt from "bcrypt";
import archiver from "archiver";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "replace_with_a_strong_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(process.cwd(), "public")));

// Constants & Helpers
const TYPES    = ["html","css","js"];
const FILE_MAP = { html:"index.html", css:"style.css", js:"script.js" };

async function getApiKey() {
  const raw = await fs.readFile("./data/api.json","utf-8");
  return JSON.parse(raw).apiKey;
}

function parseSegments(text) {
  const seg = {};
  for (const t of TYPES) {
    const re = new RegExp(`(?:(\`\`\`|''')${t}\\s*([\\s\\S]*?)\\1)`, "i");
    const m  = text.match(re);
    seg[t] = m ? m[2].trim() : "";
  }
  return seg;
}

async function fillImagePlaceholders(text) {
  // Deteksi {imgN}
  const imgIds = [...text.matchAll(/\{img(\d+)\}/g)].map(m => m[1]);

  for (const i of new Set(imgIds)) {
    const r = await fetch("https://api.waifu.im/search");
    const j = await r.json();
    if (j.images?.[0]?.url) {
      text = text.replaceAll(`{img${i}}`, j.images[0].url);
    }
  }

  // Deteksi {catN}
  const catIds = [...text.matchAll(/\{cat(\d+)\}/g)].map(m => m[1]);

  for (const i of new Set(catIds)) {
    const r = await fetch("https://api.thecatapi.com/v1/images/search");
    const j = await r.json();
    if (j?.[0]?.url) {
      text = text.replaceAll(`{cat${i}}`, j[0].url);
    }
  }

  return text;
}


async function loadUsers() {
  let raw = await fs.readFile("./data/users.json","utf-8");
  let u   = JSON.parse(raw);
  if (!Array.isArray(u)) u = Object.values(u);
  return u;
}
async function saveUsers(u) {
  await fs.writeFile("./data/users.json", JSON.stringify(u,null,2));
}

async function ensureTempDir(id) {
  const dir = path.join(process.cwd(), "temp", id);
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) throw new Error();
  } catch {
    const err = new Error("Code not found");
    err.status = 404;
    throw err;
  }
  return dir;
}

// AUTH
app.post("/api/signup", async (req,res) => {
  const { username,password } = req.body;
  if (!username||!password)
    return res.status(400).json({ error:"username & password required" });
  const users = await loadUsers();
  if (users.some(u=>u.username===username))
    return res.status(400).json({ error:"username taken" });
  const hashed = await bcrypt.hash(password,10),
        userid = uuidv4();
  users.push({ username, userid, password:hashed });
  await saveUsers(users);
  req.session.userid = userid;
  res.json({ username, userid });
});

app.post("/api/login", async (req,res) => {
  const { username,password } = req.body;
  if (!username||!password)
    return res.status(400).json({ error:"username & password required" });
  const users = await loadUsers(),
        user  = users.find(u=>u.username===username);
  if (!user || !(await bcrypt.compare(password,user.password)))
    return res.status(400).json({ error:"invalid credentials" });
  req.session.userid = user.userid;
  res.json({ username, userid:user.userid });
});

app.post("/api/logout", (req,res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error:"logout failed" });
    res.json({});
  });
});

app.get("/api/me", async (req,res) => {
  if (!req.session.userid)
    return res.status(401).json({ error:"not logged in" });
  const users = await loadUsers(),
        user  = users.find(u=>u.userid===req.session.userid);
  if (!user)
    return res.status(401).json({ error:"invalid session" });
  res.json({ username:user.username, userid:user.userid });
});

// HISTORY
app.get("/api/history", async (req,res) => {
  if (!req.session.userid)
    return res.status(401).json({ error:"not logged in" });
  const hist = JSON.parse(await fs.readFile("./data/history.json","utf-8"));
  const list = Object.entries(hist)
    .filter(([id,o])=>o.owner===req.session.userid)
    .map(([id,o])=>({ id, title:o.title }));
  res.json(list);
});

// GENERATE
app.post("/api/generate", async (req,res) => {
  if (!req.session.userid)
    return res.status(401).json({ error:"not logged in" });
  const { prompt } = req.body||{};
  if (!prompt) return res.status(400).json({ error:"Prompt required" });

  const apiKey = await getApiKey();
  const tpl    = await fs.readFile("./data/prompt.txt","utf-8");
  const final  = tpl.replace(/{prompt}/g,prompt);
  const ai     = new GoogleGenAI({ apiKey });
  const r      = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: final
  });

  let segs = parseSegments(r.text);
  for (const t of TYPES) {
    if (segs[t]) segs[t] = await fillImagePlaceholders(segs[t]);
  }

  const id  = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const dir = path.join(process.cwd(),"temp",id);
  await fs.mkdir(dir,{ recursive:true });
  for (const t of TYPES) {
    if (segs[t]) await fs.writeFile(path.join(dir, FILE_MAP[t]), segs[t], "utf-8");
  }

  const histPath = "./data/history.json";
  const hist     = JSON.parse(await fs.readFile(histPath,"utf-8"));
  hist[id]        = { owner:req.session.userid, title:prompt.slice(0,50) };
  await fs.writeFile(histPath, JSON.stringify(hist,null,2));

  res.json({ id, files:TYPES.filter(t=>!!segs[t]) });
});

// DETECT FOR EDIT
app.post("/api/detect-file", async (req,res) => {
  if (!req.session.userid) return res.status(401).json({ error:"not logged in" });
  const prompt = req.body.prompt?.trim();
  if (!prompt) return res.status(400).json({ error:"Prompt required" });

  const apiKey = await getApiKey();
  const tpl    = await fs.readFile("./data/detect.txt","utf-8");
  const final  = tpl.replace(/{prompt}/g,prompt);
  const ai     = new GoogleGenAI({ apiKey });
  const r      = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: final
  });

  const ft = r.text.trim().toLowerCase();
  if (!TYPES.includes(ft)) return res.status(400).json({ error:"Could not detect file type" });
  res.json({ fileType: ft });
});

// FETCH ALL SEGMENTS
app.get("/api/code/:id", async (req, res) => {
  if (!req.session.userid) return res.status(401).json({ error:"not logged in" });
  const id = req.params.id;
  if (!id) return res.status(400).json({ error:"Missing id" });

  try {
    const dir = await ensureTempDir(id);
    const out = {};
    for (let t of TYPES) {
      try {
        out[t] = await fs.readFile(path.join(dir, FILE_MAP[t]), "utf-8");
      } catch {
        out[t] = "";
      }
    }
    res.json(out);
  } catch (err) {
    res.status(err.status||500).json({ error: err.message });
  }
});

// FETCH SINGLE SEGMENT
app.get("/api/code/:id/:fileType", async (req,res) => {
  if (!req.session.userid) return res.status(401).json({ error:"not logged in" });
  const { id, fileType } = req.params;
  if (!id) return res.status(400).json({ error:"Missing id" });
  if (!TYPES.includes(fileType)) return res.status(400).json({ error:"Invalid fileType" });

  try {
    const dir = await ensureTempDir(id);
    const content = await fs.readFile(path.join(dir, FILE_MAP[fileType]), "utf-8");
    res.json({ content });
  } catch (err) {
    res.status(err.status||500).json({ error: err.message });
  }
});

// EDIT SINGLE FILE
app.post("/api/edit", async (req,res) => {
  if (!req.session.userid) return res.status(401).json({ error:"not logged in" });
  const { id, fileType, prompt } = req.body||{};
  if (!id || !fileType || !prompt || !TYPES.includes(fileType)) {
    return res.status(400).json({ error:"Invalid parameters" });
  }

  try {
    const dir = await ensureTempDir(id);
    const filePath = path.join(dir, FILE_MAP[fileType]);
    const existing = await fs.readFile(filePath,"utf-8");
    const tpl      = await fs.readFile("./data/edit.txt","utf-8");
    const final    = tpl.replace(/{output_code}/g, existing).replace(/{prompt}/g, prompt);

    const apiKey = await getApiKey();
    const ai     = new GoogleGenAI({ apiKey });
    const r      = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: final
    });

    let segs    = parseSegments(r.text);
    let content = segs[fileType] || r.text.trim();
    content     = await fillImagePlaceholders(content);

    await fs.writeFile(filePath, content, "utf-8");
    res.json({ fileType, content });
  } catch (err) {
    res.status(err.status||500).json({ error: err.message });
  }
});

// DOWNLOAD ZIP
app.get("/api/download/:id", (req,res) => {
  if (!req.session.userid) return res.status(401).json({ error:"not logged in" });
  const id  = req.params.id;
  const dir = path.join(process.cwd(),"temp",id);
  res.setHeader("Content-Type","application/zip");
  res.setHeader("Content-Disposition",`attachment; filename="${id}.zip"`);
  const archive = archiver("zip",{ zlib:{ level:9 } });
  archive.on("error", e => res.status(500).send({ error:e.message }));
  archive.pipe(res);
  for (const t of TYPES) {
    const fp = path.join(dir, FILE_MAP[t]);
    archive.file(fp, { name: FILE_MAP[t] });
  }
  archive.finalize();
});

// SPA Catch‑all
app.use((req,res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(process.cwd(),"public","index.html"));
  }
});

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
