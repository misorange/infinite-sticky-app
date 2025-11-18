const Database = require('better-sqlite3');
const db = new Database('tasks.db');

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    content TEXT,
    x REAL,
    y REAL,
    deadline TEXT,
    shameMessage TEXT,
    isCompleted INTEGER DEFAULT 0, -- 0: false, 1: true
    isPunished INTEGER DEFAULT 0,
    webhookUrl TEXT,
    createdAt TEXT,
    updatedAt TEXT
  )
`;

db.exec(createTableQuery);
console.log('データベースとテーブルの作成が完了しました！');
db.close();