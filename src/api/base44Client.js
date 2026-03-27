// Local client for development.
// Uses the local backend for auth (fallback to a minimal mock if backend isn't reachable).

const TOKEN_KEYS = ['base44_access_token', 'token'];
const USER_KEY = 'mock_user';

const hasWindow = typeof window !== 'undefined';

async function jsonRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = new Error(data?.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
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
  // Add other mock methods as needed for pages
};

