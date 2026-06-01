import { useState } from 'react';

export default function TodoItem({ item, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    if (trimmed !== item.text) {
      onUpdate(item.id, { text: trimmed });
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditText(item.text);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <li className={`todo-item ${item.completed ? 'completed' : ''}`}>
      <label className="todo-check-label">
        <input
          type="checkbox"
          className="todo-checkbox"
          checked={item.completed}
          onChange={() => onToggle(item.id, !item.completed)}
        />
        <span className="checkmark" />
      </label>

      {editing ? (
        <div className="todo-edit-group">
          <input
            type="text"
            className="todo-edit-input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button className="btn btn-sm btn-save" onClick={handleSave}>
            保存
          </button>
          <button className="btn btn-sm btn-cancel" onClick={handleCancel}>
            取消
          </button>
        </div>
      ) : (
        <>
          <span className="todo-text">{item.text}</span>
          <div className="todo-actions">
            <button
              className="btn btn-sm btn-edit"
              onClick={() => {
                setEditing(true);
                setEditText(item.text);
              }}
            >
              编辑
            </button>
            <button
              className="btn btn-sm btn-delete"
              onClick={() => {
                if (window.confirm('确定要删除这个任务吗？')) {
                  onDelete(item.id);
                }
              }}
            >
              删除
            </button>
          </div>
        </>
      )}
    </li>
  );
}
