import 'dotenv/config';
import fs from 'fs';
import sqlite3 from 'sqlite3';

const dbPath = process.env.DB_PATH || './data/receitas.db';
fs.mkdirSync('./data', { recursive: true });

const sql = fs.readFileSync('./init.sql', 'utf8');
const db = new sqlite3.Database(dbPath);

db.exec(sql, (err) => {
  if (err) { 
    console.error('[init] erro:', err.message);
    process.exit(1);
  }
  console.log('[init] banco inicializado em', dbPath);
  db.close();
});
