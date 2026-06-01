import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="header">
      <div className="header-inner">
        <h1 className="logo">
          <Link to="/">📋 共享待办清单</Link>
        </h1>
        {!isHome && (
          <Link to="/" className="back-link">
            ← 创建新清单
          </Link>
        )}
      </div>
    </header>
  );
}
