import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createList } from '../api';

export default function HomePage() {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const list = await createList(trimmed);
      navigate(`/list/${list.shareId}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="page home-page">
      <div className="card">
        <h2 className="card-title">创建新的共享清单</h2>
        <p className="card-desc">
          创建一个待办清单，分享链接给朋友，所有人可以实时协作编辑。
        </p>

        <form onSubmit={handleSubmit} className="create-form">
          <input
            type="text"
            className="input"
            placeholder="输入清单标题，例如：超市购物清单"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            autoFocus
          />
          {error && <p className="error-msg">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || !title.trim()}
          >
            {loading ? '创建中...' : '创建清单'}
          </button>
        </form>
      </div>
    </div>
  );
}
