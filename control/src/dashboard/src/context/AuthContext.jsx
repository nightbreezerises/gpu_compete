import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 认证函数
  const authenticate = useCallback(async (pwd) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: pwd })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsAuthenticated(true);
        setPassword(pwd);
        setShowLoginModal(false);
        return { success: true };
      } else {
        return { success: false, message: data.message || '登录失败' };
      }
    } catch (error) {
      return { success: false, message: '连接失败，请检查网络' };
    }
  }, []);

  // 检查是否需要密码
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/check');
      const data = await response.json();
      
      if (data.requires_auth) {
        setShowLoginModal(true);
      } else {
        setIsAuthenticated(true);
        setShowLoginModal(false);
      }
    } catch (error) {
      setShowLoginModal(true);
    }
  }, []);

  // 带认证的请求函数（现在不需要Basic Auth）
  const authenticatedFetch = useCallback(async (url, options = {}) => {
    // 直接使用fetch，不需要认证头
    return fetch(url, options);
  }, []);

  // 登出
  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setPassword('');
    setShowLoginModal(true);
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      password,
      setPassword,
      showLoginModal,
      setShowLoginModal,
      authenticate,
      checkAuth,
      authenticatedFetch,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
