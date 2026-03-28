// Local client for development.
// Uses the local backend for auth (fallback to a minimal mock if backend isn't reachable).

const TOKEN_KEYS = ['base44_access_token', 'token'];
const USER_KEY = 'mock_user';

const hasWindow = typeof window !== 'undefined';

const API_BASE_URL = (() => {
  try {
    const raw = import.meta.env.VITE_BASE44_APP_BASE_URL;
    const value = typeof raw === 'string' ? raw.trim() : '';
    return value ? value.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
})();

function resolveApiUrl(path) {
  const value = String(path ?? '');
  if (/^https?:\/\//i.test(value)) return value;
  if (!API_BASE_URL) return value;
  if (!value.startsWith('/')) return `${API_BASE_URL}/${value}`;
  return `${API_BASE_URL}${value}`;
}

async function jsonRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(resolveApiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    const e = new Error('network_error');
    e.status = 0;
    e.data = { error: 'network_error', detail: err?.message ? String(err.message) : String(err) };
    throw e;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  const rawText = !isJson ? await res.text().catch(() => '') : '';

  if (!res.ok) {
    const proxyLooksDown =
      !isJson &&
      res.status === 500 &&
      typeof rawText === 'string' &&
      /ECONNREFUSED|ECONNRESET|ENOTFOUND|proxy error/i.test(rawText);

    const code = proxyLooksDown ? 'network_error' : (data?.error ?? `HTTP ${res.status}`);
    const issues = Array.isArray(data?.issues) ? data.issues : null;
    const detail = data?.detail ? String(data.detail) : rawText ? String(rawText).slice(0, 600) : '';
    const issuesText = issues
      ? issues
          .map((issue) => {
            const path = Array.isArray(issue?.path) ? issue.path.join('.') : '';
            const msg = issue?.message ? String(issue.message) : 'invalid';
            return path ? `${path}: ${msg}` : msg;
          })
          .join(' | ')
      : '';

    const parts = [issuesText, detail].filter(Boolean);
    const err = new Error(parts.length ? `${code}: ${parts.join(' | ')}` : code);
    err.status = res.status;
    err.data = proxyLooksDown ? { error: 'network_error', detail } : data;
    throw err;
  }

  return data;
}

const getToken = () => {
  if (!hasWindow) return null;
  for (const key of TOKEN_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

const setToken = (token) => {
  if (!hasWindow) return;
  window.localStorage.setItem('token', token);
};

const clearToken = () => {
  if (!hasWindow) return;
  for (const key of TOKEN_KEYS) {
    window.localStorage.removeItem(key);
  }
};

const getStoredUser = () => {
  if (!hasWindow) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setStoredUser = (user) => {
  if (!hasWindow) return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearStoredUser = () => {
  if (!hasWindow) return;
  window.localStorage.removeItem(USER_KEY);
};

async function authedJsonRequest(path, { method = 'GET', body } = {}) {
  const token = getToken();
  if (!token) {
    const err = new Error('unauthorized');
    err.status = 401;
    err.data = { error: 'unauthorized' };
    throw err;
  }
  try {
    return await jsonRequest(path, { method, body, token });
  } catch (e) {
    if (e?.status === 401) {
      clearToken();
      clearStoredUser();
    }
    throw e;
  }
}

export const base44 = {
  auth: {
    me: async () => {
      const token = getToken();
      if (!token) return null;

      try {
        const res = await jsonRequest('/api/auth/me', { token });
        const user = res?.user ?? null;
        if (user) setStoredUser(user);
        return user;
      } catch (e) {
        // Token invalid/expired or backend unavailable.
        if (e?.status === 401) {
          clearToken();
          clearStoredUser();
          return null;
        }
        // Fallback to stored user so the UI still works offline.
        return getStoredUser();
      }
    },
    login: async ({ email, password } = {}) => {
      if (!email || !password) {
        throw new Error('Missing credentials');
      }

      try {
        const res = await jsonRequest('/api/auth/login', { method: 'POST', body: { email, password } });
        const token = res?.token;
        const user = res?.user;
        if (!token || !user) throw new Error('invalid_response');
        setToken(token);
        setStoredUser(user);
        return user;
      } catch (e) {
        // Backend respondeu com erro (ex: credenciais inválidas). Propaga para o UI.
        if (e?.status) throw e;
        // If backend isn't reachable yet, keep the old mock behaviour.
        const user = { id: 'local-user', email, full_name: email.split('@')[0] ?? 'User' };
        setToken('mock-token');
        setStoredUser(user);
        return user;
      }
    },
    register: async ({ email, password, full_name } = {}) => {
      if (!email || !password) {
        throw new Error('Missing credentials');
      }

      try {
        const res = await jsonRequest('/api/auth/register', {
          method: 'POST',
          body: { email, password, full_name },
        });
        return res?.user ?? null;
      } catch (e) {
        // Backend respondeu com erro (ex: email já existe). Propaga para o UI.
        if (e?.status) throw e;
        // Fallback mock registration (no persistence on server).
        return { id: 'local-user', email, full_name: full_name ?? email.split('@')[0] ?? 'User' };
      }
    },
    requestPasswordReset: async ({ email } = {}) => {
      if (!email) throw new Error('Missing email');
      return jsonRequest('/api/auth/password-reset/request', { method: 'POST', body: { email } });
    },
    confirmPasswordReset: async ({ token, new_password } = {}) => {
      if (!token || !new_password) throw new Error('Missing fields');
      return jsonRequest('/api/auth/password-reset/confirm', { method: 'POST', body: { token, new_password } });
    },
    logout: () => {
      clearToken();
      clearStoredUser();
    },
    redirectToLogin: () => {
      if (!hasWindow) return;
      window.location.assign('/conta');
    },
  },
  user: {
    me: async () => {
      const res = await authedJsonRequest('/api/users/me');
      const user = res?.user ?? null;
      if (user) setStoredUser(user);
      return user;
    },
    updateMe: async (patch) => {
      const res = await authedJsonRequest('/api/users/me', { method: 'PATCH', body: patch });
      const user = res?.user ?? null;
      if (user) setStoredUser(user);
      return user;
    },
  },
  orders: {
    my: async () => {
      const res = await authedJsonRequest('/api/orders/my');
      return res?.orders ?? [];
    },
  },
  entities: {
    Product: {
      list: async (order = '-created_date', limit = 100) => {
        const params = new URLSearchParams();
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/admin/products?${params.toString()}`);
      },
      filter: async (where = {}, order = '-created_date', limit = 100) => {
        const params = new URLSearchParams();
        Object.entries(where ?? {}).forEach(([k, v]) => {
          if (v === undefined || v === null || v === '') return;
          params.set(k, String(v));
        });
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return jsonRequest(`/api/products?${params.toString()}`);
      },
      create: async (data) => authedJsonRequest('/api/admin/products', { method: 'POST', body: data }),
      update: async (id, data) => authedJsonRequest(`/api/admin/products/${id}`, { method: 'PATCH', body: data }),
      delete: async (id) => authedJsonRequest(`/api/admin/products/${id}`, { method: 'DELETE' }),
    },
    Order: {
      list: async (order = '-created_date', limit = 100) => {
        const params = new URLSearchParams();
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/admin/orders?${params.toString()}`);
      },
      create: async (data) => jsonRequest('/api/orders', { method: 'POST', body: data }),
      update: async (id, data) => authedJsonRequest(`/api/admin/orders/${id}`, { method: 'PATCH', body: data }),
    },
    BlogPost: {
      list: async (order = '-created_date', limit = 100) => {
        const params = new URLSearchParams();
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/admin/blog-posts?${params.toString()}`);
      },
      filter: async (where = {}, order = '-created_date', limit = 100) => {
        const params = new URLSearchParams();
        Object.entries(where ?? {}).forEach(([k, v]) => {
          if (v === undefined || v === null || v === '') return;
          params.set(k, String(v));
        });
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return jsonRequest(`/api/blog-posts?${params.toString()}`);
      },
      create: async (data) => authedJsonRequest('/api/admin/blog-posts', { method: 'POST', body: data }),
      update: async (id, data) => authedJsonRequest(`/api/admin/blog-posts/${id}`, { method: 'PATCH', body: data }),
      delete: async (id) => authedJsonRequest(`/api/admin/blog-posts/${id}`, { method: 'DELETE' }),
    },
    Review: {
      filter: async (where = {}, order = '-created_date', limit = 200) => {
        const params = new URLSearchParams();
        Object.entries(where ?? {}).forEach(([k, v]) => {
          if (v === undefined || v === null || v === '') return;
          params.set(k, String(v));
        });
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return jsonRequest(`/api/reviews?${params.toString()}`);
      },
    },
    Wishlist: {
      list: async (order = '-created_date', limit = 50) => {
        const params = new URLSearchParams();
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/wishlist?${params.toString()}`);
      },
      create: async (data) => authedJsonRequest('/api/wishlist', { method: 'POST', body: data }),
      delete: async (id) => authedJsonRequest(`/api/wishlist/${id}`, { method: 'DELETE' }),
    },
    User: {
      list: async (order = '-created_date', limit = 100) => {
        const params = new URLSearchParams();
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/admin/users?${params.toString()}`);
      },
      update: async (id, patch) => authedJsonRequest(`/api/admin/users/${id}`, { method: 'PATCH', body: patch }),
      orders: async (id) => authedJsonRequest(`/api/admin/users/${id}/orders`),
      wishlist: async (id) => authedJsonRequest(`/api/admin/users/${id}/wishlist`),
    },
    Supplier: {
      list: async (order = '-created_date', limit = 200) => {
        const params = new URLSearchParams();
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/admin/suppliers?${params.toString()}`);
      },
      create: async (data) => authedJsonRequest('/api/admin/suppliers', { method: 'POST', body: data }),
      update: async (id, data) => authedJsonRequest(`/api/admin/suppliers/${id}`, { method: 'PATCH', body: data }),
      delete: async (id) => authedJsonRequest(`/api/admin/suppliers/${id}`, { method: 'DELETE' }),
    },
    Purchase: {
      list: async (order = '-purchased_at', limit = 200) => {
        const params = new URLSearchParams();
        if (order) params.set('order', order);
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/admin/purchases?${params.toString()}`);
      },
      create: async (data) => authedJsonRequest('/api/admin/purchases', { method: 'POST', body: data }),
      update: async (id, data) => authedJsonRequest(`/api/admin/purchases/${id}`, { method: 'PATCH', body: data }),
    },
    FaqItem: {
      list: async (limit = 500) => {
        const params = new URLSearchParams();
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/admin/faq?${params.toString()}`);
      },
      create: async (data) => authedJsonRequest('/api/admin/faq', { method: 'POST', body: data }),
      update: async (id, data) => authedJsonRequest(`/api/admin/faq/${id}`, { method: 'PATCH', body: data }),
      delete: async (id) => authedJsonRequest(`/api/admin/faq/${id}`, { method: 'DELETE' }),
    },
    InstagramPost: {
      list: async (limit = 200) => {
        const params = new URLSearchParams();
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/admin/instagram?${params.toString()}`);
      },
      create: async (data) => authedJsonRequest('/api/admin/instagram', { method: 'POST', body: data }),
      update: async (id, data) => authedJsonRequest(`/api/admin/instagram/${id}`, { method: 'PATCH', body: data }),
      delete: async (id) => authedJsonRequest(`/api/admin/instagram/${id}`, { method: 'DELETE' }),
    },
    ProductReview: {
      create: async (data) => authedJsonRequest('/api/reviews', { method: 'POST', body: data }),
    },
  },
  integrations: {
    Core: {
      UploadFile: async ({ file } = {}) => {
        if (!file) throw new Error('Missing file');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('file_read_failed'));
          reader.readAsDataURL(file);
        });
        return { file_url: String(dataUrl) };
      },
    },
  },
		  admin: {
		    logs: {
		      list: async (limit = 200) => {
		        const params = new URLSearchParams();
		        if (limit) params.set('limit', String(limit));
		        return authedJsonRequest(`/api/admin/logs?${params.toString()}`);
		      },
		    },
        orders: {
          create: async (data) => authedJsonRequest('/api/admin/orders', { method: 'POST', body: data }),
        },
		    analytics: {
		      summary: async (days = 30) => {
		        const params = new URLSearchParams();
		        if (days) params.set('days', String(days));
		        return authedJsonRequest(`/api/admin/analytics/summary?${params.toString()}`);
		      },
		    },
		    support: {
		      tickets: {
		        list: async (limit = 500) => {
		          const params = new URLSearchParams();
	          if (limit) params.set('limit', String(limit));
	          return authedJsonRequest(`/api/admin/support/tickets?${params.toString()}`);
	        },
	        get: async (id) => authedJsonRequest(`/api/admin/support/tickets/${id}`),
	        addMessage: async (id, message) =>
	          authedJsonRequest(`/api/admin/support/tickets/${id}/messages`, { method: 'POST', body: { message } }),
	        update: async (id, patch) => authedJsonRequest(`/api/admin/support/tickets/${id}`, { method: 'PATCH', body: patch }),
	      },
	    },
		    blogComments: {
		      list: async ({ approved = 'false', post_id, limit = 500 } = {}) => {
		        const params = new URLSearchParams();
		        if (approved) params.set('approved', String(approved));
		        if (post_id) params.set('post_id', String(post_id));
		        if (limit) params.set('limit', String(limit));
		        return authedJsonRequest(`/api/admin/blog-comments?${params.toString()}`);
		      },
		      get: async (id) => authedJsonRequest(`/api/admin/blog-comments/${id}`),
		      reply: async (id, message) =>
		        authedJsonRequest(`/api/admin/blog-comments/${id}/replies`, { method: 'POST', body: { message } }),
		      approve: async (id, is_approved) =>
		        authedJsonRequest(`/api/admin/blog-comments/${id}`, { method: 'PATCH', body: { is_approved } }),
		      delete: async (id) => authedJsonRequest(`/api/admin/blog-comments/${id}`, { method: 'DELETE' }),
		    },
        reviews: {
          list: async ({ product_id, approved = 'all', limit = 200 } = {}) => {
            const params = new URLSearchParams();
            if (product_id) params.set('product_id', String(product_id));
            if (approved) params.set('approved', String(approved));
            if (limit) params.set('limit', String(limit));
            return authedJsonRequest(`/api/admin/reviews?${params.toString()}`);
          },
          approve: async (id, is_approved) =>
            authedJsonRequest(`/api/admin/reviews/${id}`, { method: 'PATCH', body: { is_approved } }),
          delete: async (id) => authedJsonRequest(`/api/admin/reviews/${id}`, { method: 'DELETE' }),
        },
			    content: {
			      about: {
			        get: async () => authedJsonRequest('/api/admin/content/about'),
			        update: async (data) => authedJsonRequest('/api/admin/content/about', { method: 'PATCH', body: data }),
			      },
	      landing: {
	        get: async () => authedJsonRequest('/api/admin/content/landing'),
	        update: async (data) => authedJsonRequest('/api/admin/content/landing', { method: 'PATCH', body: data }),
	      },
	      payments: {
	        get: async () => authedJsonRequest('/api/admin/content/payments'),
	        update: async (data) => authedJsonRequest('/api/admin/content/payments', { method: 'PATCH', body: data }),
	      },
        shipping: {
          get: async () => authedJsonRequest('/api/admin/content/shipping'),
          update: async (data) => authedJsonRequest('/api/admin/content/shipping', { method: 'PATCH', body: data }),
        },
	    },
    inventory: {
      list: async (limit = 500) => {
        const params = new URLSearchParams();
        if (limit) params.set('limit', String(limit));
        return authedJsonRequest(`/api/admin/inventory?${params.toString()}`);
      },
      adjust: async (data) => authedJsonRequest('/api/admin/inventory/adjust', { method: 'POST', body: data }),
    },
  },
		  content: {
		    about: async () => jsonRequest('/api/content/about'),
		    landing: async () => jsonRequest('/api/content/landing'),
		    payments: async () => jsonRequest('/api/content/payments'),
        shipping: async () => jsonRequest('/api/content/shipping'),
		  },
	  blog: {
	    comments: {
	      list: async (postId, limit = 200) => {
	        const params = new URLSearchParams();
	        if (limit) params.set('limit', String(limit));
	        const token = getToken();
	        return jsonRequest(`/api/blog-posts/${postId}/comments?${params.toString()}`, { token });
	      },
	      create: async (postId, data) => {
	        const token = getToken();
	        return jsonRequest(`/api/blog-posts/${postId}/comments`, { method: 'POST', body: data, token });
	      },
	      reply: async (commentId, message) =>
	        authedJsonRequest(`/api/blog-comments/${commentId}/replies`, { method: 'POST', body: { message } }),
	    },
	  },
	  notifications: {
	    list: async () => authedJsonRequest('/api/notifications'),
	  },
		  support: {
		    tickets: {
		      list: async (limit = 200) => {
		        const params = new URLSearchParams();
		        if (limit) params.set('limit', String(limit));
		        return authedJsonRequest(`/api/support/tickets?${params.toString()}`);
		      },
		      create: async (data) => authedJsonRequest('/api/support/tickets', { method: 'POST', body: data }),
		      get: async (id) => authedJsonRequest(`/api/support/tickets/${id}`),
		      addMessage: async (id, message) =>
		        authedJsonRequest(`/api/support/tickets/${id}/messages`, { method: 'POST', body: { message } }),
		    },
		    chat: {
		      get: async () => authedJsonRequest('/api/support/chat'),
		      open: async () => authedJsonRequest('/api/support/chat/open', { method: 'POST' }),
		      send: async (message) => authedJsonRequest('/api/support/chat/messages', { method: 'POST', body: { message } }),
		      close: async () => authedJsonRequest('/api/support/chat/close', { method: 'POST' }),
		    },
		  },
		  faq: {
		    list: async () => jsonRequest('/api/faq'),
		  },
	  instagram: {
	    list: async (limit = 30) => {
	      const params = new URLSearchParams();
	      if (limit) params.set('limit', String(limit));
	      return jsonRequest(`/api/instagram?${params.toString()}`);
	    },
	    analytics: {
	      summary: async (days = 30) => {
	        const params = new URLSearchParams();
	        if (days) params.set('days', String(days));
	        return authedJsonRequest(`/api/admin/analytics/summary?${params.toString()}`);
	      },
	    },
	  },
  analytics: {
    pageview: async ({ path, referrer } = {}) => jsonRequest('/api/analytics/pageview', { method: 'POST', body: { path, referrer } }),
    productView: async ({ product_id } = {}) => jsonRequest('/api/analytics/product-view', { method: 'POST', body: { product_id } }),
    search: async ({ query } = {}) => jsonRequest('/api/analytics/search', { method: 'POST', body: { query } }),
  },
};

