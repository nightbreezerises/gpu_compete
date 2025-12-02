import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#f4f5f6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      display: 'flex',
      overflow: 'hidden'
    }}>
      <Sidebar />
      
      {/* 主内容区域 */}
      <div className="page-container" style={{
        width: '100%',
        padding: '0 10px',
        height: 'calc(100vh - 60px)',
        marginLeft: '160px',
        WebkitOverflowScrolling: 'touch',
        overflowY: 'scroll',
        overflowX: 'hidden'
      }}>
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
