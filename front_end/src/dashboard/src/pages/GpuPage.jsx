import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import GpuCard from '../components/GpuCard';

const GpuPage = () => {
  const { authenticatedFetch } = useAuth();
  const [gpuData, setGpuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshRate, setRefreshRate] = useState(1000);
  const intervalRef = useRef(null);

  const fetchGpuData = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/gpu');
      if (response.ok) {
        const data = await response.json();
        setGpuData(data);
        setLastUpdate(new Date());
        setError(null);
      } else {
        setError('获取 GPU 数据失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    fetchGpuData();
    intervalRef.current = setInterval(fetchGpuData, refreshRate);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchGpuData, refreshRate]);

  const refreshOptions = [
    { label: '0.5秒', value: 500 },
    { label: '1秒', value: 1000 },
    { label: '2秒', value: 2000 },
    { label: '5秒', value: 5000 },
  ];

  if (loading && !gpuData) {
    return (
      <div className="container" style={{ width: '97%', margin: '20px auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px',
          color: '#6b7280'
        }}>
          加载中...
        </div>
      </div>
    );
  }

  if (error && !gpuData) {
    return (
      <div className="container" style={{ width: '97%', margin: '20px auto' }}>
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#fef2f2', 
          borderRadius: '8px',
          color: '#dc2626',
          textAlign: 'center'
        }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ width: '97%', margin: '20px auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h2 style={{
          fontSize: '24px',
          color: '#2c8af8',
          margin: 0,
          fontWeight: '700',
          textShadow: '0 2px 6px rgba(44,138,248,0.4)'
        }}>
          GPU 监控
        </h2>
        <div style={{
          fontSize: '12px',
          color: '#9ca3af',
          backgroundColor: '#f1f5f9',
          padding: '4px 12px',
          borderRadius: '4px'
        }}>
          类似 nvitop 实时监控
        </div>
      </div>

      {gpuData?.available ? (
        <div>
          {/* 刷新率控制 */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>刷新间隔:</span>
            {refreshOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRefreshRate(opt.value)}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: refreshRate === opt.value ? '#2c8af8' : '#e5e7eb',
                  color: refreshRate === opt.value ? '#fff' : '#374151',
                  transition: 'all 0.2s ease'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 概览信息 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginBottom: '12px'
          }}>
            <div style={{
              backgroundColor: '#eff6ff',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
                {gpuData.gpu_count}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>GPU 数量</div>
            </div>
            
            <div style={{
              backgroundColor: '#f0fdf4',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                {gpuData.total_processes}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>运行进程</div>
            </div>
            
            <div style={{
              backgroundColor: '#faf5ff',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c3aed' }}>
                {gpuData.memory_percent}%
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>显存使用</div>
            </div>
            
            <div style={{
              backgroundColor: '#fff7ed',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ea580c' }}>
                {gpuData.active_user_count}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>活跃用户</div>
            </div>
          </div>

          {/* 主机信息 */}
          {gpuData.host && (
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ color: '#374151' }}>
                  🖥️ <strong>{gpuData.host.hostname}</strong>
                </span>
                <span style={{ color: '#6b7280' }}>
                  CPU: {gpuData.host.cpu?.percent}% ({gpuData.host.cpu?.count} cores)
                </span>
                <span style={{ color: '#6b7280' }}>
                  内存: {gpuData.host.memory?.used_human} / {gpuData.host.memory?.total_human}
                </span>
              </div>
              <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                更新: {lastUpdate?.toLocaleTimeString()}
              </div>
            </div>
          )}

          {/* GPU 卡片网格 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {gpuData.gpus?.map((gpu, idx) => (
              <GpuCard key={gpu.index ?? idx} gpu={gpu} />
            ))}
          </div>

          {/* 活跃用户 */}
          {gpuData.active_users && gpuData.active_users.length > 0 && (
            <div style={{
              marginTop: '20px',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              fontSize: '13px'
            }}>
              <span style={{ color: '#6b7280' }}>活跃用户: </span>
              {gpuData.active_users.map((user, idx) => (
                <span key={user} style={{
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  marginLeft: idx > 0 ? '8px' : '4px',
                  fontWeight: '500'
                }}>
                  {user}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#fef3c7', 
          borderRadius: '8px',
          color: '#92400e',
          textAlign: 'center'
        }}>
          {gpuData?.error || 'GPU 监控不可用'}
        </div>
      )}
    </div>
  );
};

export default GpuPage;
