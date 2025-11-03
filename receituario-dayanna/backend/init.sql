PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_number INTEGER NOT NULL
);

INSERT OR IGNORE INTO counter (id, last_number) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rxNo TEXT NOT NULL UNIQUE,
  paciente TEXT,
  endereco TEXT,
  idade TEXT,
  data TEXT,
  diag TEXT,
  presc TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_rxNo ON prescriptions (rxNo);
CREATE INDEX IF NOT EXISTS idx_prescriptions_paciente ON prescriptions (paciente);
CREATE INDEX IF NOT EXISTS idx_prescriptions_data ON prescriptions (data);
