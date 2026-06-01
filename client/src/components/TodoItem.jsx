import { useState } from 'react';

const COLORS = [
  { key: 'red', label: '红色', hex: '#e74c3c' },
  { key: 'yellow', label: '黄色', hex: '#f1c40f' },
  { key: 'blue', label: '蓝色', hex: '#3498db' },
  { key: 'green', label: '绿色', hex: '#27ae60' },
];

export default function TodoItem({
  item,
  depth,
  onToggle,
  onUpdate,
  onDelete,
  onAddSubtask,
  onSetColor,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOverId,
  dragOverPos,
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const maxDepth = 2;

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

  const colorClass = item.color ? `color-${item.color}` : '';
  const isDragOver = dragOverId === item.id;

  return (
    <div className={`todo-item-wrapper depth-${depth}`}>
      <li
        className={`todo-item ${item.completed ? 'completed' : ''} ${colorClass} ${isDragOver ? `drag-over-${dragOverPos}` : ''}`}
        draggable={!editing}
        onDragStart={(e) => onDragStart && onDragStart(e, item.id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver && onDragOver(e, item.id)}
        onDragLeave={(e) => onDragLeave && onDragLeave(e, item.id)}
        onDrop={(e) => onDrop && onDrop(e, item.id)}
      >
        {/* Drag handle */}
        {!editing && (
          <span className="drag-handle" title="拖拽排序">
            ⋮⋮
          </span>
        )}

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
              {/* Color selector */}
              <div className="color-dots">
                {COLORS.map((c) => (
                  <button
                    key={c.key}
                    className={`color-dot ${c.key} ${item.color === c.key ? 'active' : ''}`}
                    title={c.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetColor(item.id, item.color === c.key ? null : c.key);
                    }}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>

              {/* Add subtask button */}
              {depth < maxDepth && (
                <button
                  className="btn btn-sm btn-subtask"
                  onClick={() => onAddSubtask(item.id)}
                  title="添加子任务"
                >
                  + 子任务
                </button>
              )}

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
                  const msg = item.children && item.children.length > 0
                    ? '确定要删除这个任务及其所有子任务吗？'
                    : '确定要删除这个任务吗？';
                  if (window.confirm(msg)) {
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

      {/* Render children recursively */}
      {item.children && item.children.length > 0 && (
        <ul className="todo-children">
          {item.children.map((child) => (
            <TodoItem
              key={child.id}
              item={child}
              depth={depth + 1}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              onSetColor={onSetColor}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              dragOverId={dragOverId}
              dragOverPos={dragOverPos}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
