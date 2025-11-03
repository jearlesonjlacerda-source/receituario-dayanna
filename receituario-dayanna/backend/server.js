// server.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

// ---- Configs básicas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || '123456';
const DB_PATH = process.env.DB_PATH || './data/receitas.db';
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);

// Garante pasta do DB
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new sqlite3.Database(DB_PATH);

// ---- App Express
const app = express();
app.use(helmet());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));

// CORS liberado só pras origens configuradas
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // permite file:// e chamadas locais
    if (!ALLOWED.length || ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed: ' + origin));
  }
}));

// Rate limit simples
const limiter = rateLimit({ windowMs: 60_000, max: 120 });
app.use(limiter);

// Auth por chave
app.use(cors());

// Helpers DB
const now = () => Date.now();
const all = (sql, params=[]) => new Promise((res, rej)=>{
  db.all(sql, params, (err, rows)=> err?rej(err):res(rows));
});
const run = (sql, params=[]) => new Promise((res, rej)=>{
  db.run(sql, params, function(err){ if(err) rej(err); else res({ changes:this.changes, lastID:this.lastID }); });
});

// Health
app.get('/health', (req,res)=> res.json({ ok:true, ts: now() }));

// ----- Counter: preview e next (atômico)
app.get('/counter/preview', async (req,res)=>{
  try{
    const rows = await all('SELECT last_number FROM counter WHERE id=1');
    const last = rows[0]?.last_number ?? 0;
    res.json({ last, next: last+1, rxNo: String(last+1).padStart(6,'0') });
  }catch(e){ res.status(500).json({ error:e.message }); }
});

app.post('/counter/next', async (req,res)=>{
  db.serialize(async ()=>{
    try{
      await run('BEGIN IMMEDIATE');
      const rows = await all('SELECT last_number FROM counter WHERE id=1');
      const last = rows[0]?.last_number ?? 0;
      const next = last + 1;
      await run('UPDATE counter SET last_number=? WHERE id=1', [next]);
      await run('COMMIT');
      res.json({ consumed: next, rxNo: String(next).padStart(6,'0') });
    }catch(e){
      await run('ROLLBACK').catch(()=>{});
      res.status(500).json({ error:e.message });
    }
  });
});

// ----- Prescriptions CRUD
app.get('/prescriptions', async (req,res)=>{
  const q = (req.query.q||'').toLowerCase();
  try{
    let rows = await all('SELECT * FROM prescriptions ORDER BY createdAt DESC');
    if(q){
      rows = rows.filter(r =>
        (r.rxNo||'').toLowerCase().includes(q) ||
        (r.paciente||'').toLowerCase().includes(q) ||
        (r.data||'').toLowerCase().includes(q) ||
        (r.diag||'').toLowerCase().includes(q) ||
        (r.presc||'').toLowerCase().includes(q)
      );
    }
    res.json(rows);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

app.post('/prescriptions', async (req,res)=>{
  const b = req.body || {};
  try{
    let rxNo = b.rxNo;
    if(!rxNo){
      const rows = await all('SELECT last_number FROM counter WHERE id=1');
      const last = rows[0]?.last_number ?? 0;
      const next = last + 1;
      await run('UPDATE counter SET last_number=? WHERE id=1', [next]);
      rxNo = String(next).padStart(6,'0');
    }
    const t = now();
    const sql = `INSERT INTO prescriptions
      (rxNo,paciente,endereco,idade,data,diag,presc,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?)`;
    await run(sql, [
      rxNo, b.paciente||'', b.endereco||'', b.idade||'', b.data||'',
      b.diag||'', b.presc||'', t, t
    ]);
    const item = (await all('SELECT * FROM prescriptions WHERE rxNo=?', [rxNo]))[0];
    res.status(201).json(item);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

app.get('/prescriptions/:id', async (req,res)=>{
  try{
    const rows = await all('SELECT * FROM prescriptions WHERE id=?', [req.params.id]);
    if(!rows.length) return res.status(404).json({ error:'not_found' });
    res.json(rows[0]);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

app.put('/prescriptions/:id', async (req,res)=>{
  const b = req.body || {};
  try{
    const t = now();
    const sql = `UPDATE prescriptions SET
      paciente=?, endereco=?, idade=?, data=?, diag=?, presc=?, updatedAt=?
      WHERE id=?`;
    const r = await run(sql, [
      b.paciente||'', b.endereco||'', b.idade||'', b.data||'',
      b.diag||'', b.presc||'', t, req.params.id
    ]);
    if(!r.changes) return res.status(404).json({ error:'not_found' });
    const item = (await all('SELECT * FROM prescriptions WHERE id=?', [req.params.id]))[0];
    res.json(item);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

app.delete('/prescriptions/:id', async (req,res)=>{
  try{
    const r = await run('DELETE FROM prescriptions WHERE id=?', [req.params.id]);
    if(!r.changes) return res.status(404).json({ error:'not_found' });
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:e.message }); }
});

app.listen(PORT, ()=> console.log(`API on http://localhost:${PORT}`));
