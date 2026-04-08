import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from './api';

interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [token, setToken]   = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Attach token to all requests
  useEffect(() => {
    const interceptor = api.interceptors.request.use(config => {
      const t = localStorage.getItem('token');
      if (t) config.headers.Authorization = `Bearer ${t}`;
      return config;
    });
    return () => api.interceptors.request.eject(interceptor);
  }, []);

  // Redirect to login on 401
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401 && token) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
        return Promise.reject(err);
      },
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [token]);

  // Validate token on load
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { setUser(data); })
      .catch(() => { localStorage.removeItem('token'); setToken(null); setUser(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
