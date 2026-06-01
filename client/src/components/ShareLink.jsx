import { useState } from 'react';

export default function ShareLink({ shareId }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/list/${shareId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="share-link">
      <label className="share-label">分享链接：</label>
      <div className="share-row">
        <input
          type="text"
          className="share-input"
          value={link}
          readOnly
          onClick={(e) => e.target.select()}
        />
        <button className="btn btn-copy" onClick={handleCopy}>
          {copied ? '✅ 已复制' : '📋 复制'}
        </button>
      </div>
      <p className="share-hint">
        将链接发送给朋友，他们可以实时查看和编辑这个清单
      </p>
    </div>
  );
}
