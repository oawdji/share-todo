const API_BASE = '/api';

async function request(url, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const res = await fetch(`${API_BASE}${url}`, config);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `请求失败 (${res.status})`);
  }

  return res.json();
}

export function createList(title) {
  return request('/lists', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function getList(shareId) {
  return request(`/lists/${shareId}`);
}

export function addItem(shareId, text, parentId = null, color = null) {
  return request(`/lists/${shareId}/items`, {
    method: 'POST',
    body: JSON.stringify({ text, parentId, color }),
  });
}

export function updateItem(shareId, itemId, updates) {
  return request(`/lists/${shareId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteItem(shareId, itemId) {
  return request(`/lists/${shareId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

export function reorderItems(shareId, itemId, targetId, position) {
  return request(`/lists/${shareId}/items/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ itemId, targetId, position }),
  });
}
