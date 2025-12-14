const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory store
let tasks = [];

// Helper to simulate server timestamp
const nowIso = () => new Date().toISOString();

// GET /api/tasks
app.get('/api/tasks', (req, res) => {
  res.json({
    ok: true,
    data: tasks
  });
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'ok' });
});

// POST /api/tasks - create
app.post('/api/tasks', (req, res) => {
  const t = req.body;
  const newTask = Object.assign({}, t, {
    id: t.id || uuidv4(),
    updatedAt: nowIso()
  });
  tasks.push(newTask);
  console.log('[mock] created', newTask.id);
  res.status(201).json({ ok: true, data: newTask });
});

// PUT /api/tasks/:id - update
app.put('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  const idx = tasks.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });
  const updated = Object.assign({}, tasks[idx], req.body, { updatedAt: nowIso() });
  tasks[idx] = updated;
  console.log('[mock] updated', id);
  res.json({ ok: true, data: updated });
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  tasks = tasks.filter(x => x.id !== id);
  console.log('[mock] deleted', id);
  res.json({ ok: true });
});

// Simple reset endpoint for testing
app.post('/api/_reset', (req, res) => {
  tasks = req.body.tasks || [];
  console.log('[mock] reset, count=', tasks.length);
  res.json({ ok: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Mock server listening at http://0.0.0.0:${port}`);
});
