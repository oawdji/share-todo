import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// Helper: get list by share_id, return null if not found
function getListByShareId(shareId) {
  return db.prepare('SELECT * FROM lists WHERE share_id = ?').get(shareId);
}

// Helper: find item by id and list_id
function getItem(itemId, listId) {
  return db
    .prepare('SELECT * FROM items WHERE id = ? AND list_id = ?')
    .get(itemId, listId);
}

// Helper: broadcast to all clients in a room
function broadcast(io, shareId, event, payload) {
  io.to(shareId).emit(event, payload);
}

// POST /api/lists/:shareId/items - Add a new item
router.post('/:shareId/items', (req, res) => {
  const list = getListByShareId(req.params.shareId);
  if (!list) {
    return res.status(404).json({ error: '清单不存在' });
  }

  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: '任务内容不能为空' });
  }

  // Compute next position
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM items WHERE list_id = ?')
    .get(list.id);

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO items (id, list_id, text, position, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, list.id, text.trim(), maxPos.next_pos, now);

  // Update list's updated_at
  db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').run(now, list.id);

  const item = getItem(id, list.id);
  const itemData = {
    id: item.id,
    text: item.text,
    completed: item.completed === 1,
    position: item.position,
    createdAt: item.created_at,
  };

  const io = req.app.locals.io;
  io.to(req.params.shareId).emit('item-added', {
    shareId: req.params.shareId,
    item: itemData,
  });

  res.status(201).json(itemData);
});

// PATCH /api/lists/:shareId/items/:itemId - Update an item
router.patch('/:shareId/items/:itemId', (req, res) => {
  const list = getListByShareId(req.params.shareId);
  if (!list) {
    return res.status(404).json({ error: '清单不存在' });
  }

  const item = getItem(req.params.itemId, list.id);
  if (!item) {
    return res.status(404).json({ error: '任务不存在' });
  }

  const { text, completed } = req.body;
  const updates = [];
  const params = [];

  if (text !== undefined) {
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: '任务内容不能为空' });
    }
    updates.push('text = ?');
    params.push(text.trim());
  }

  if (completed !== undefined) {
    updates.push('completed = ?');
    params.push(completed ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  const now = new Date().toISOString();
  params.push(req.params.itemId, list.id);

  db.prepare(
    `UPDATE items SET ${updates.join(', ')} WHERE id = ? AND list_id = ?`
  ).run(...params);

  // Update list's updated_at
  db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').run(now, list.id);

  const updatedItem = getItem(req.params.itemId, list.id);
  const itemData = {
    id: updatedItem.id,
    text: updatedItem.text,
    completed: updatedItem.completed === 1,
    position: updatedItem.position,
    createdAt: updatedItem.created_at,
  };

  const io = req.app.locals.io;
  io.to(req.params.shareId).emit('item-updated', {
    shareId: req.params.shareId,
    item: itemData,
  });

  res.json(itemData);
});

// DELETE /api/lists/:shareId/items/:itemId - Delete an item
router.delete('/:shareId/items/:itemId', (req, res) => {
  const list = getListByShareId(req.params.shareId);
  if (!list) {
    return res.status(404).json({ error: '清单不存在' });
  }

  const item = getItem(req.params.itemId, list.id);
  if (!item) {
    return res.status(404).json({ error: '任务不存在' });
  }

  db.prepare('DELETE FROM items WHERE id = ? AND list_id = ?').run(
    req.params.itemId,
    list.id
  );

  // Update list's updated_at
  const now = new Date().toISOString();
  db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').run(now, list.id);

  const io = req.app.locals.io;
  io.to(req.params.shareId).emit('item-deleted', {
    shareId: req.params.shareId,
    itemId: req.params.itemId,
  });

  res.json({ success: true });
});

export default router;
