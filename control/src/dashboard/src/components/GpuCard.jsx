import React from 'react';
import ProgressBar from './ProgressBar';

// GPU 卡片组件
const GpuCard = ({ gpu }) => {
  const memPercent = gpu.memory?.percent || 0;
  const gpuUtil = gpu.utilization?.gpu || 0;
  const temp = gpu.temperature || 0;
  
  const getTempColor = (t) => {
    if (t >= 80) return '#ef4444';
    if (t >= 60) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: '1px solid #e5e7eb'
    }}>
      {/* GPU 标题 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            backgroundColor: '#2c8af8',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            GPU {gpu.index}
          </span>
          <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
            {gpu.name}
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: getTempColor(temp),
          fontSize: '14px',
          fontWeight: '500'
        }}>
          🌡️ {temp}°C
        </div>
      </div>

      {/* GPU 利用率 */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '12px', 
          color: '#6b7280',
          marginBottom: '4px'
        }}>
          <span>GPU 利用率</span>
          <span style={{ fontFamily: 'monospace' }}>{gpuUtil}%</span>
        </div>
        <ProgressBar value={gpuUtil} color="#10b981" height={6} showText={false} />
      </div>

      {/* 显存使用 */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '12px', 
          color: '#6b7280',
          marginBottom: '4px'
        }}>
          <span>显存</span>
          <span style={{ fontFamily: 'monospace' }}>
            {gpu.memory?.used_human} / {gpu.memory?.total_human}
          </span>
        </div>
        <ProgressBar value={memPercent} color="#8b5cf6" height={6} showText={false} />
      </div>

      {/* 功耗 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        fontSize: '12px', 
        color: '#6b7280',
        marginBottom: '8px'
      }}>
        <span>功耗</span>
        <span style={{ fontFamily: 'monospace' }}>
          {gpu.power?.draw_human} / {gpu.power?.limit_human}
        </span>
      </div>

      {/* 进程列表 */}
      {gpu.processes && gpu.processes.length > 0 && (
        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '10px',
          marginTop: '8px'
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#6b7280', 
            marginBottom: '6px',
            fontWeight: '500'
          }}>
            进程 ({gpu.processes.length})
          </div>
          <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
            {gpu.processes.map((proc, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                padding: '4px 0',
                borderBottom: idx < gpu.processes.length - 1 ? '1px solid #f3f4f6' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ 
                    color: '#2c8af8', 
                    fontFamily: 'monospace',
                    minWidth: '50px'
                  }}>
                    {proc.pid}
                  </span>
                  <span style={{ 
                    color: '#059669',
                    fontWeight: '500'
                  }}>
                    {proc.username}
                  </span>
                </div>
                <span style={{ 
                  color: '#7c3aed', 
                  fontFamily: 'monospace'
                }}>
                  {proc.gpu_memory_human}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GpuCard;
