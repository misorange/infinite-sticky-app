const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const axios = require('axios');

const app = express();
const PORT = 3001;
const db = new Database('tasks.db');

const DEFAULT_WEBHOOK_URL = "YOUR_DISCORD_WEBHOOK_URL_HERE";

app.use(cors());
app.use(express.json());


app.get('/api/tasks', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM tasks');
    const tasks = stmt.all().map(task => ({
      ...task,
      isCompleted: !!task.isCompleted,
      isPunished: !!task.isPunished
    }));
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/api/tasks', (req, res) => {
  const { content, x, y, deadline, shameMessage, webhookUrl } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO tasks (id, content, x, y, deadline, shameMessage, webhookUrl, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const deadlineStr = deadline ? new Date(deadline).toISOString() : null;

    stmt.run(id, content, x, y, deadlineStr, shameMessage, webhookUrl, now, now);

    res.status(201).json({ 
      id, content, x, y, deadline: deadlineStr, shameMessage, webhookUrl, isCompleted: false, isPunished: false 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { content, x, y, isCompleted, deadline, shameMessage, webhookUrl } = req.body;
  const now = new Date().toISOString();
  
  try {
    const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Task not found' });

    const updated = {
      content: content !== undefined ? content : current.content,
      x: x !== undefined ? x : current.x,
      y: y !== undefined ? y : current.y,
      isCompleted: isCompleted !== undefined ? (isCompleted ? 1 : 0) : current.isCompleted,
      deadline: deadline !== undefined ? (deadline ? new Date(deadline).toISOString() : null) : current.deadline,
      shameMessage: shameMessage !== undefined ? shameMessage : current.shameMessage,
      webhookUrl: webhookUrl !== undefined ? webhookUrl : current.webhookUrl,
      updatedAt: now
    };

    const stmt = db.prepare(`
      UPDATE tasks 
      SET content = ?, x = ?, y = ?, isCompleted = ?, deadline = ?, shameMessage = ?, webhookUrl = ?, updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(updated.content, updated.x, updated.y, updated.isCompleted, updated.deadline, updated.shameMessage, updated.webhookUrl, updated.updatedAt, id);

    res.json({ ...updated, isCompleted: !!updated.isCompleted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});


const executePunishment = async () => {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE isCompleted = 0 
    AND isPunished = 0 
    AND deadline IS NOT NULL 
    AND deadline < ?
  `);
  
  const doomedTasks = stmt.all(now);

  if (doomedTasks.length > 0) {
    console.log(`💀 処刑対象発見: ${doomedTasks.length}件`);
  }

  for (const task of doomedTasks) {
    try {
      const DEFAULT_WEBHOOK_URL = "YOUR_DISCORD_WEBHOOK_URL_HERE";
      
      if (!DEFAULT_WEBHOOK_URL) {
        console.log(`⚠️ Webhook URLがないためスキップ: ${task.content}`);
        continue;
      }
      const message = `
🚨 **DEADLINE MISSED** 🚨
タスク: **${task.content}**
期限: ${new Date(task.deadline).toLocaleString('ja-JP')}
罰ゲーム: **${task.shameMessage || "情けないですね..."}**
`;

      await axios.post(DEFAULT_WEBHOOK_URL, {
        content: message
      });

      console.log(`🔥 処刑執行: ${task.content}`);

      const updateStmt = db.prepare('UPDATE tasks SET isPunished = 1 WHERE id = ?');
      updateStmt.run(task.id);

    } catch (error) {
      console.error(`❌ 処刑失敗 (${task.content}):`, error.message);
    }
  }
};

cron.schedule('* * * * *', () => {
  executePunishment();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`💀 Punishment system activated.`);
});