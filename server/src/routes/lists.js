import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// POST /api/lists - Create a new todo list
router.post('/', (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' });
  }

  const id = uuidv4();
  const shareId = uuidv4();

  const stmt = db.prepare(
    'INSERT INTO lists (id, title, share_id) VALUES (?, ?, ?)'
  );
  stmt.run(id, title.trim(), shareId);

  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(id);

  res.status(201).json({
    id: list.id,
    title: list.title,
    shareId: list.share_id,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
    items: [],
  });
});

// GET /api/lists/:shareId - Get a list by share ID
router.get('/:shareId', (req, res) => {
  const { shareId } = req.params;

  const list = db
    .prepare('SELECT * FROM lists WHERE share_id = ?')
    .get(shareId);

  if (!list) {
    return res.status(404).json({ error: '清单不存在' });
  }

  const items = db
    .prepare('SELECT * FROM items WHERE list_id = ? ORDER BY position ASC')
    .all(list.id);

  res.json({
    id: list.id,
    title: list.title,
    shareId: list.share_id,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
    items: items.map((item) => ({
      id: item.id,
      text: item.text,
      completed: item.completed === 1,
      position: item.position,
      createdAt: item.created_at,
    })),
  });
});

export default router;
