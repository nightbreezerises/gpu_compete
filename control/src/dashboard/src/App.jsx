import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginModal from './components/LoginModal';
import GpuPage from './pages/GpuPage';
import CommandPage from './pages/CommandPage';
import StatusPage from './pages/StatusPage';
import RulePage from './pages/RulePage';
import SettingPage from './pages/SettingPage';

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, checkAuth, showLoginModal } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      checkAuth();
    }
  }, [isAuthenticated, checkAuth]);

  return (
    <>
      {children}
      <LoginModal />
    </>
  );
};

// 主应用组件
const AppContent = () => {
  return (
    <Routes>
      <Route path="/ui" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/ui/gpu" replace />} />
        <Route path="gpu" element={<GpuPage />} />
        <Route path="command" element={<CommandPage />} />
        <Route path="state" element={<StatusPage />} />
        <Route path="rule" element={<RulePage />} />
        <Route path="setting" element={<SettingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/ui/gpu" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
