import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getList, addItem, updateItem, deleteItem } from '../api';
import socket from '../socket';
import ShareLink from '../components/ShareLink';
import TodoItem from '../components/TodoItem';

export default function ListPage() {
  const { shareId } = useParams();
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(0);

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
        prev.map((i) => (i.id === item.id ? { ...i, ...item } : i))
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

    socket.on('item-added', handleItemAdded);
    socket.on('item-updated', handleItemUpdated);
    socket.on('item-deleted', handleItemDeleted);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.emit('leave-list', { shareId });
      socket.off('item-added', handleItemAdded);
      socket.off('item-updated', handleItemUpdated);
      socket.off('item-deleted', handleItemDeleted);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [shareId]);

  // Add new item
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

  // Toggle item completed
  const handleToggle = useCallback(async (itemId, completed) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, completed } : i))
    );
    try {
      await updateItem(shareId, itemId, { completed });
    } catch (err) {
      // Revert on failure
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

  // Delete item
  const handleDelete = useCallback(async (itemId) => {
    // Optimistic update
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

        {items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📝</span>
            <p>还没有任务，在上方添加第一个吧！</p>
          </div>
        ) : (
          <ul className="todo-list">
            {items.map((item) => (
              <TodoItem
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}

        <div className="list-footer">
          <span>
            {items.length} 个任务
            {items.filter((i) => i.completed).length > 0 &&
              ` · ${items.filter((i) => i.completed).length} 个已完成`}
          </span>
        </div>
      </div>
    </div>
  );
}
