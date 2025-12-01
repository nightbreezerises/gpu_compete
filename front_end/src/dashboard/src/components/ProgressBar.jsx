import React from 'react';

// GPU 进度条组件
const ProgressBar = ({ value, max = 100, color = '#2c8af8', height = 8, showText = true }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const getColor = () => {
    if (percent >= 90) return '#ef4444';
    if (percent >= 70) return '#f59e0b';
    return color;
  };
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
      <div style={{
        flex: 1,
        height: `${height}px`,
        backgroundColor: '#e5e7eb',
        borderRadius: `${height / 2}px`,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percent}%`,
          height: '100%',
          backgroundColor: getColor(),
          borderRadius: `${height / 2}px`,
          transition: 'width 0.3s ease, background-color 0.3s ease'
        }} />
      </div>
      {showText && (
        <span style={{ 
          fontSize: '12px', 
          color: '#6b7280', 
          minWidth: '45px', 
          textAlign: 'right',
          fontFamily: 'monospace'
        }}>
          {percent.toFixed(1)}%
        </span>
      )}
    </div>
  );
};

export default ProgressBar;
