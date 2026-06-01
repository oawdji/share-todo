import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getList, addItem, updateItem, deleteItem, reorderItems } from '../api';
import socket from '../socket';
import ShareLink from '../components/ShareLink';
import TodoItem from '../components/TodoItem';

// Build a tree from flat items array (sorted by position)
function buildTree(items) {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const map = {};
  const roots = [];
  sorted.forEach((i) => {
    i.children = [];
    map[i.id] = i;
  });
  sorted.forEach((i) => {
    if (i.parentId && map[i.parentId]) {
      map[i.parentId].children.push(i);
    } else {
      roots.push(i);
    }
  });
  // Sort children by position within each parent
  Object.values(map).forEach((item) => {
    if (item.children.length > 0) {
      item.children.sort((a, b) => a.position - b.position);
    }
  });
  return roots;
}

// Recursively count all items including descendants
function countAll(tree) {
  let count = 0;
  let completed = 0;
  function walk(nodes) {
    for (const node of nodes) {
      count++;
      if (node.completed) completed++;
      if (node.children) walk(node.children);
    }
  }
  walk(tree);
  return { count, completed };
}

export default function ListPage() {
  const { shareId } = useParams();
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState(null);
  const [subtaskText, setSubtaskText] = useState('');
  const [dragItemId, setDragItemId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragOverPos, setDragOverPos] = useState(null);

  // Fetch list data
  useEffect(() => {
    let cancelled = false;

    async function fetchList() {
      try {
        const data = await getList(shareId);
        if (!cancelled) {
          setList(data);
          setItems(data.items);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchList();
    return () => { cancelled = true; };
  }, [shareId]);

  // Join socket room and listen for events
  useEffect(() => {
    socket.emit('join-list', { shareId });

    const handleItemAdded = ({ item }) => {
      setItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        return [...prev, item];
      });
    };

    const handleItemUpdated = ({ item }) => {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, ...item, children: i.children } : i))
      );
    };

    const handleItemDeleted = ({ itemId }) => {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    };

    const handleUserJoined = ({ count }) => {
      setConnectedUsers(count);
    };

    const handleUserLeft = ({ count }) => {
      setConnectedUsers(count);
    };

    const handleItemsReordered = ({ items: reorderedItems }) => {
      setItems((prev) => {
        const updated = [...prev];
        for (const ri of reorderedItems) {
          const idx = updated.findIndex((i) => i.id === ri.id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], position: ri.position, children: updated[idx].children };
          }
        }
        updated.sort((a, b) => a.position - b.position);
        return updated;
      });
    };

    socket.on('item-added', handleItemAdded);
    socket.on('item-updated', handleItemUpdated);
    socket.on('item-deleted', handleItemDeleted);
    socket.on('items-reordered', handleItemsReordered);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.emit('leave-list', { shareId });
      socket.off('item-added', handleItemAdded);
      socket.off('item-updated', handleItemUpdated);
      socket.off('item-deleted', handleItemDeleted);
      socket.off('items-reordered', handleItemsReordered);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [shareId]);

  // Add new root item
  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed) return;

    setAdding(true);
    try {
      const item = await addItem(shareId, trimmed);
      setItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        return [...prev, item];
      });
      setNewText('');
    } catch (err) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  }, [shareId, newText]);

  // Start adding a subtask
  const handleAddSubtask = useCallback((parentId) => {
    setAddingSubtaskFor(parentId);
    setSubtaskText('');
  }, []);

  // Submit subtask
  const handleSubmitSubtask = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = subtaskText.trim();
    if (!trimmed || !addingSubtaskFor) return;

    setAdding(true);
    try {
      const item = await addItem(shareId, trimmed, addingSubtaskFor);
      setItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        return [...prev, item];
      });
      setSubtaskText('');
      setAddingSubtaskFor(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  }, [shareId, subtaskText, addingSubtaskFor]);

  // Cancel subtask
  const handleCancelSubtask = useCallback(() => {
    setAddingSubtaskFor(null);
    setSubtaskText('');
  }, []);

  // Toggle item completed
  const handleToggle = useCallback(async (itemId, completed) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, completed } : i))
    );
    try {
      await updateItem(shareId, itemId, { completed });
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, completed: !completed } : i))
      );
      alert(err.message);
    }
  }, [shareId]);

  // Update item text
  const handleUpdate = useCallback(async (itemId, updates) => {
    try {
      await updateItem(shareId, itemId, updates);
    } catch (err) {
      alert(err.message);
    }
  }, [shareId]);

  // Set item color
  const handleSetColor = useCallback(async (itemId, color) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, color } : i))
    );
    try {
      await updateItem(shareId, itemId, { color });
    } catch (err) {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, color: i.color } : i))
      );
      alert(err.message);
    }
  }, [shareId]);

  // Delete item
  const handleDelete = useCallback(async (itemId) => {
    // Optimistic update - remove the item
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await deleteItem(shareId, itemId);
    } catch (err) {
      alert(err.message);
      // Reload to get correct state
      try {
        const data = await getList(shareId);
        setItems(data.items);
      } catch { /* ignore */ }
    }
  }, [shareId]);

  // Drag: start
  const handleDragStart = useCallback((e, itemId) => {
    setDragItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
    requestAnimationFrame(() => {
      e.currentTarget.classList.add('dragging');
    });
  }, []);

  // Drag: end — cleanup all DOM drag classes
  const handleDragEnd = useCallback(() => {
    setDragItemId(null);
    setDragOverId(null);
    setDragOverPos(null);
    document.querySelectorAll('.todo-item.dragging').forEach((el) => {
      el.classList.remove('dragging');
    });
    document.querySelectorAll('.todo-item.drag-over-before, .todo-item.drag-over-after').forEach((el) => {
      el.classList.remove('drag-over-before', 'drag-over-after');
    });
  }, []);

  // Drag: over another item
  const handleDragOver = useCallback((e, itemId) => {
    e.preventDefault();
    if (!dragItemId || dragItemId === itemId) return;
    e.dataTransfer.dropEffect = 'move';

    // Determine if dropped before or after based on cursor Y relative to item center
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'before' : 'after';

    setDragOverId(itemId);
    setDragOverPos(pos);
  }, [dragItemId]);

  // Drag: leave
  const handleDragLeave = useCallback((e, itemId) => {
    // Only clear if we're actually leaving this element
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverId === itemId) {
      setDragOverId(null);
      setDragOverPos(null);
    }
  }, [dragOverId]);

  // Drop: reorder
  const handleDrop = useCallback(async (e, targetId) => {
    e.preventDefault();
    const itemId = dragItemId;
    if (!itemId || itemId === targetId) {
      handleDragEnd();
      return;
    }

    const pos = dragOverPos || 'after';
    const item = items.find((i) => i.id === itemId);
    const target = items.find((i) => i.id === targetId);
    if (!item || !target) { handleDragEnd(); return; }

    // Only allow reorder within same parent level
    if (item.parentId !== target.parentId) { handleDragEnd(); return; }

    // Optimistic local reorder
    setItems((prev) => {
      const updated = [...prev];
      const siblings = updated.filter((i) => i.parentId === item.parentId);
      const others = updated.filter((i) => i.id !== itemId && i.parentId !== item.parentId);

      // Sort siblings by position
      siblings.sort((a, b) => a.position - b.position);

      // Remove moved item
      const draggedItem = siblings.find((i) => i.id === itemId);
      const filtered = siblings.filter((i) => i.id !== itemId);

      // Find target index in filtered
      const targetIdx = filtered.findIndex((i) => i.id === targetId);
      if (targetIdx === -1) return prev;

      // Insert at position
      const insertIdx = pos === 'before' ? targetIdx : targetIdx + 1;
      filtered.splice(insertIdx, 0, draggedItem);

      // Reassign positions
      filtered.forEach((i, idx) => { i.position = idx + 1; });

      return [...others, ...filtered].sort((a, b) => a.position - b.position);
    });

    handleDragEnd();

    try {
      await reorderItems(shareId, itemId, targetId, pos);
    } catch (err) {
      alert(err.message);
      // Reload to sync
      try {
        const data = await getList(shareId);
        setItems(data.items);
      } catch { /* ignore */ }
    }
  }, [dragItemId, dragOverPos, items, shareId, handleDragEnd]);

  if (loading) {
    return (
      <div className="page list-page">
        <div className="card">
          <p className="loading">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page list-page">
        <div className="card">
          <div className="error-state">
            <span className="error-icon">😢</span>
            <h2>清单不存在</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const tree = buildTree(items);
  const { count, completed } = countAll(tree);

  return (
    <div className="page list-page">
      <ShareLink shareId={shareId} />

      <div className="card">
        <div className="list-header">
          <h2 className="list-title">{list.title}</h2>
          {connectedUsers > 0 && (
            <span className="online-badge">
              🟢 {connectedUsers} 人在线
            </span>
          )}
        </div>

        {/* Root item add form */}
        <form className="add-form" onSubmit={handleAdd}>
          <input
            type="text"
            className="input"
            placeholder="添加新任务..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            disabled={adding}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={adding || !newText.trim()}
          >
            {adding ? '添加中...' : '添加'}
          </button>
        </form>

        {tree.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📝</span>
            <p>还没有任务，在上方添加第一个吧！</p>
          </div>
        ) : (
          <ul className="todo-list">
            {tree.map((item) => (
              <TodoItem
                key={item.id}
                item={item}
                depth={0}
                onToggle={handleToggle}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onAddSubtask={handleAddSubtask}
                onSetColor={handleSetColor}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                dragOverId={dragOverId}
                dragOverPos={dragOverPos}
              />
            ))}
          </ul>
        )}

        {/* Inline subtask form */}
        {addingSubtaskFor && (
          <div className="subtask-form">
            <form onSubmit={handleSubmitSubtask}>
              <input
                type="text"
                className="input"
                placeholder="输入子任务内容..."
                value={subtaskText}
                onChange={(e) => setSubtaskText(e.target.value)}
                disabled={adding}
                autoFocus
              />
              <div className="subtask-form-actions">
                <button
                  type="submit"
                  className="btn btn-sm btn-save"
                  disabled={adding || !subtaskText.trim()}
                >
                  添加子任务
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-cancel"
                  onClick={handleCancelSubtask}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="list-footer">
          <span>
            {count} 个任务
            {completed > 0 && ` · ${completed} 个已完成`}
          </span>
        </div>
      </div>
    </div>
  );
}
