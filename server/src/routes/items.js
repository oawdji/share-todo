import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

// Helper: get list by share_id
function getListByShareId(shareId) {
  return db.prepare('SELECT * FROM lists WHERE share_id = ?').get(shareId);
}

// Helper: find item by id and list_id
function getItem(itemId, listId) {
  return db
    .prepare('SELECT * FROM items WHERE id = ? AND list_id = ?')
    .get(itemId, listId);
}

// Helper: format item for JSON response
function formatItem(item) {
  return {
    id: item.id,
    text: item.text,
    completed: item.completed === 1,
    position: item.position,
    color: item.color || null,
    parentId: item.parent_id || null,
    createdAt: item.created_at,
  };
}

// Helper: calculate depth of an item by walking up parent chain
function getItemDepth(itemId) {
  let depth = 0;
  let currentId = itemId;
  while (currentId) {
    const item = db.prepare('SELECT parent_id FROM items WHERE id = ?').get(currentId);
    if (!item || !item.parent_id) break;
    depth++;
    currentId = item.parent_id;
    if (depth > 10) break; // safety limit
  }
  return depth;
}

// Helper: collect all descendant IDs recursively
function collectDescendants(itemId) {
  const result = [];
  const children = db.prepare('SELECT id FROM items WHERE parent_id = ?').all(itemId);
  for (const child of children) {
    result.push(child.id);
    result.push(...collectDescendants(child.id));
  }
  return result;
}

// POST /api/lists/:shareId/items - Add a new item
router.post('/:shareId/items', (req, res) => {
  const list = getListByShareId(req.params.shareId);
  if (!list) {
    return res.status(404).json({ error: '清单不存在' });
  }

  const { text, parentId, color } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: '任务内容不能为空' });
  }

  // Validate color
  const validColors = ['red', 'yellow', 'blue', 'green'];
  if (color && !validColors.includes(color)) {
    return res.status(400).json({ error: '无效的颜色值' });
  }

  // Validate parentId and depth
  let actualParentId = null;
  if (parentId) {
    const parent = db.prepare('SELECT * FROM items WHERE id = ? AND list_id = ?').get(parentId, list.id);
    if (!parent) {
      return res.status(404).json({ error: '父任务不存在' });
    }
    // Check depth: parent's depth must be < 2 (0=root, 1=child -> can add to make depth 2=grandchild)
    const parentDepth = getItemDepth(parentId);
    if (parentDepth >= 2) {
      return res.status(400).json({ error: '已达到最大嵌套层级（3级）' });
    }
    actualParentId = parentId;
  }

  // Compute next position among siblings
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM items WHERE list_id = ? AND parent_id IS ?')
    .get(list.id, actualParentId);

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO items (id, list_id, text, position, color, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, list.id, text.trim(), maxPos.next_pos, color || null, actualParentId, now);

  // Update list's updated_at
  db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').run(now, list.id);

  const item = getItem(id, list.id);
  const itemData = formatItem(item);

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

  const { text, completed, color } = req.body;
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

  if (color !== undefined) {
    const validColors = ['red', 'yellow', 'blue', 'green'];
    if (color !== null && !validColors.includes(color)) {
      return res.status(400).json({ error: '无效的颜色值' });
    }
    updates.push('color = ?');
    params.push(color || null);
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
  const itemData = formatItem(updatedItem);

  const io = req.app.locals.io;
  io.to(req.params.shareId).emit('item-updated', {
    shareId: req.params.shareId,
    item: itemData,
  });

  res.json(itemData);
});

// DELETE /api/lists/:shareId/items/:itemId - Delete an item and all descendants
router.delete('/:shareId/items/:itemId', (req, res) => {
  const list = getListByShareId(req.params.shareId);
  if (!list) {
    return res.status(404).json({ error: '清单不存在' });
  }

  const item = getItem(req.params.itemId, list.id);
  if (!item) {
    return res.status(404).json({ error: '任务不存在' });
  }

  // Collect all descendant IDs, then delete them all
  const descendantIds = collectDescendants(req.params.itemId);
  const allIds = [req.params.itemId, ...descendantIds];

  const deleteStmt = db.prepare('DELETE FROM items WHERE id = ? AND list_id = ?');
  for (const id of allIds) {
    deleteStmt.run(id, list.id);
  }

  // Update list's updated_at
  const now = new Date().toISOString();
  db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').run(now, list.id);

  const io = req.app.locals.io;
  // Broadcast deletion of all removed items
  for (const id of allIds) {
    io.to(req.params.shareId).emit('item-deleted', {
      shareId: req.params.shareId,
      itemId: id,
    });
  }

  res.json({ success: true, deletedIds: allIds });
});

// PUT /api/lists/:shareId/items/reorder - Reorder an item relative to a target
router.put('/:shareId/items/reorder', (req, res) => {
  const list = getListByShareId(req.params.shareId);
  if (!list) {
    return res.status(404).json({ error: '清单不存在' });
  }

  const { itemId, targetId, position } = req.body; // position: 'before' | 'after'
  if (!itemId || !targetId || !position) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  if (position !== 'before' && position !== 'after') {
    return res.status(400).json({ error: 'position 必须是 before 或 after' });
  }

  const item = getItem(itemId, list.id);
  const target = getItem(targetId, list.id);
  if (!item || !target) {
    return res.status(404).json({ error: '任务不存在' });
  }

  // Both must share the same parent_id (or both be null)
  if (item.parent_id !== target.parent_id) {
    return res.status(400).json({ error: '只能在同一层级内拖拽排序' });
  }

  // Get all siblings ordered by position
  const siblings = db
    .prepare('SELECT * FROM items WHERE list_id = ? AND parent_id IS ? ORDER BY position ASC')
    .all(list.id, item.parent_id);

  // Remove the dragged item from siblings
  const filtered = siblings.filter((s) => s.id !== itemId);

  // Find target index in filtered list
  const targetIdx = filtered.findIndex((s) => s.id === targetId);
  if (targetIdx === -1) {
    return res.status(400).json({ error: '目标不在同级任务中' });
  }

  // Insert at new position
  const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
  filtered.splice(insertIdx, 0, item);

  // Reassign positions
  const now = new Date().toISOString();
  const updateStmt = db.prepare('UPDATE items SET position = ? WHERE id = ?');
  const updatedItems = [];

  for (let i = 0; i < filtered.length; i++) {
    updateStmt.run(i + 1, filtered[i].id);
    updatedItems.push(formatItem(
      db.prepare('SELECT * FROM items WHERE id = ?').get(filtered[i].id)
    ));
  }

  db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').run(now, list.id);

  const io = req.app.locals.io;
  io.to(req.params.shareId).emit('items-reordered', {
    shareId: req.params.shareId,
    items: updatedItems,
  });

  res.json({ success: true, items: updatedItems });
});

export default router;
