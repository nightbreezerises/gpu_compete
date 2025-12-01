import React from 'react';

const StatusPage = () => {
  return (
    <div className="container" style={{ width: '97%', margin: '20px auto' }}>
      <h2 style={{
        fontSize: '24px',
        color: '#2c8af8',
        margin: '0 0 16px 0',
        fontWeight: '700',
        textShadow: '0 2px 6px rgba(44,138,248,0.4)'
      }}>
        服务状态
      </h2>
      <div style={{
        fontSize: '14px',
        color: '#54759a',
        lineHeight: '1.6'
      }}>
        服务状态监控功能正在开发中...
      </div>
    </div>
  );
};

export default StatusPage;
