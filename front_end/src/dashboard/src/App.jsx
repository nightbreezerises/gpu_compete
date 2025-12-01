import React, { useState, useEffect, useCallback, useRef } from 'react';

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

// 系统设置组件
const SystemSettings = ({ authenticatedFetch }) => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [warnings, setWarnings] = useState([]);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setError(null);
      } else {
        setError('获取设置失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    setWarnings([]);

    try {
      // 提取值
      const settingsData = {};
      Object.keys(settings).forEach(key => {
        settingsData[key] = settings[key].value;
      });

      const response = await authenticatedFetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsData)
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(true);
        setWarnings(result.warnings || []);
        
        // 显示重启提示
        if (result.requires_restart && result.requires_restart.length > 0) {
          setError(`以下设置需要重启后生效: ${result.requires_restart.join(', ')}`);
        }
        
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || '保存失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: value
      }
    }));
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px',
        color: '#6b7280'
      }}>
        加载中...
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#fef2f2', 
        borderRadius: '8px',
        color: '#dc2626',
        textAlign: 'center'
      }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      {success && (
        <div style={{
          marginBottom: '15px',
          padding: '15px',
          background: 'linear-gradient(135deg, #5dae34, #67c23a)',
          boxShadow: '0 2px 8px rgba(93,174,52,0.3)',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#fff',
          lineHeight: '1.6',
          textAlign: 'justify'
        }}>
          ✓ 设置保存成功
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{
          marginBottom: '15px',
          padding: '15px',
          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
          boxShadow: '0 2px 8px rgba(245,158,11,0.3)',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#fff',
          lineHeight: '1.6'
        }}>
          <div style={{ fontWeight: '700', marginBottom: '8px' }}>⚠️ 注意事项：</div>
          {warnings.map((warning, idx) => (
            <div key={idx} style={{ marginBottom: '4px' }}>• {warning}</div>
          ))}
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: '15px',
          padding: '15px',
          background: 'linear-gradient(135deg, #f56c6c, #e74c3c)',
          boxShadow: '0 2px 8px rgba(245,108,108,0.3)',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#fff',
          lineHeight: '1.6'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '12px'
          }}>
            {/* 目标 YAML 路径 */}
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#24292e',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              target-yaml-path
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {settings['target-yaml-path']?.description}
              </div>
              <input
                type="text"
                value={settings['target-yaml-path']?.value || ''}
                onChange={(e) => handleChange('target-yaml-path', e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  border: '1px solid #e4eaef',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#24292e',
                  backgroundColor: '#fff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#57befc'
                  e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e4eaef'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </label>

            {/* 日志目录 */}
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#24292e',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              log-dir
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {settings['log-dir']?.description}
              </div>
              <input
                type="text"
                value={settings['log-dir']?.value || ''}
                onChange={(e) => handleChange('log-dir', e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  border: '1px solid #e4eaef',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#24292e',
                  backgroundColor: '#fff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#57befc'
                  e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e4eaef'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </label>

            {/* 端口 */}
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#24292e',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              port
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {settings['port']?.description}
              </div>
              {settings['port']?.requires_restart && (
                <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>
                  ⚠️ 需要重启生效
                </div>
              )}
              <input
                type="number"
                value={settings['port']?.value || ''}
                onChange={(e) => handleChange('port', parseInt(e.target.value) || '')}
                min={1}
                max={65535}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  border: '1px solid #e4eaef',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#24292e',
                  backgroundColor: '#fff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#57befc'
                  e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e4eaef'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </label>

            {/* 允许局域网访问 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              color: '#24292e',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              <input
                type="checkbox"
                checked={!!settings['allow-lan']?.value}
                onChange={(e) => handleChange('allow-lan', e.target.checked)}
                style={{
                  marginRight: '8px',
                  width: '16px',
                  height: '16px'
                }}
              />
              <div>
                allow-lan
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  {settings['allow-lan']?.description}
                </div>
              </div>
            </div>

            {/* 绑定地址 */}
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#24292e',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              bind-address
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {settings['bind-address']?.description}
              </div>
              {settings['bind-address']?.requires_restart && (
                <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>
                  ⚠️ 需要重启生效
                </div>
              )}
              <select
                value={settings['bind-address']?.value || ''}
                onChange={(e) => handleChange('bind-address', e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  border: '1px solid #e4eaef',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#24292e',
                  backgroundColor: '#fff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#57befc'
                  e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e4eaef'
                  e.target.style.boxShadow = 'none'
                }}
              >
                <option value="0.0.0.0">0.0.0.0 (所有接口)</option>
                <option value="127.0.0.1">127.0.0.1 (仅本地)</option>
                <option value="localhost">localhost (仅本地)</option>
              </select>
            </label>

            {/* 日志级别 */}
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#24292e',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              log-level
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {settings['log-level']?.description}
              </div>
              <select
                value={settings['log-level']?.value || ''}
                onChange={(e) => handleChange('log-level', e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  border: '1px solid #e4eaef',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#24292e',
                  backgroundColor: '#fff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#57befc'
                  e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e4eaef'
                  e.target.style.boxShadow = 'none'
                }}
              >
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="error">error</option>
                <option value="critical">critical</option>
              </select>
            </label>

            
            {/* 访问密钥 */}
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#24292e',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              secret
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {settings['secret']?.description}
              </div>
              <input
                type="password"
                value={settings['secret']?.value || ''}
                onChange={(e) => handleChange('secret', e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  border: '1px solid #e4eaef',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#24292e',
                  backgroundColor: '#fff',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#57befc'
                  e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e4eaef'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </label>
          </div>

          {/* 按钮区域 - clash-dashboard风格 */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px',
            paddingTop: '15px',
            borderTop: '1px solid #e4eaef'
          }}>
            <button
              type="button"
              onClick={fetchSettings}
              disabled={saving}
              style={{
                height: '30px',
                padding: '0 15px',
                color: '#54759a',
                fontSize: '12px',
                lineHeight: '30px',
                background: '#fff',
                border: '1px solid #e4eaef',
                borderRadius: '3px',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                outline: 'none'
              }}
              onMouseOver={(e) => {
                if (!saving) {
                  e.target.style.borderColor = '#57befc'
                  e.target.style.color = '#2c8af8'
                }
              }}
              onMouseOut={(e) => {
                e.target.style.borderColor = '#e4eaef'
                e.target.style.color = '#54759a'
              }}
            >
              重置
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                height: '30px',
                padding: '0 15px',
                color: '#fff',
                fontSize: '12px',
                lineHeight: '30px',
                background: saving ? '#b7c5d6' : 'linear-gradient(135deg, #57befc, #2c8af8)',
                border: 'none',
                borderRadius: '3px',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxShadow: saving ? 'none' : '0 2px 8px rgba(44,138,248,0.4)'
              }}
            >
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
      </form>
    </div>
  );
};

// GPU 监控主组件
const GpuMonitor = ({ authenticatedFetch }) => {
  const [gpuData, setGpuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshRate, setRefreshRate] = useState(1000); // 默认1秒刷新
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

  // 刷新率选项
  const refreshOptions = [
    { label: '0.5秒', value: 500 },
    { label: '1秒', value: 1000 },
    { label: '2秒', value: 2000 },
    { label: '5秒', value: 5000 },
  ];

  if (loading && !gpuData) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px',
        color: '#6b7280'
      }}>
        加载中...
      </div>
    );
  }

  if (error && !gpuData) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#fef2f2', 
        borderRadius: '8px',
        color: '#dc2626',
        textAlign: 'center'
      }}>
        {error}
      </div>
    );
  }

  if (!gpuData?.available) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#fef3c7', 
        borderRadius: '8px',
        color: '#92400e',
        textAlign: 'center'
      }}>
        {gpuData?.error || 'GPU 监控不可用'}
      </div>
    );
  }

  return (
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
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('error');
  const [showLogin, setShowLogin] = useState(true);
  const [activeTab, setActiveTab] = useState('gpu'); // 当前激活的标签页
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // 认证函数
  const authenticate = async (pwd) => {
    try {
      const credentials = btoa(`admin:${pwd}`);
      const response = await fetch('/api/config', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });
      
      if (response.ok) {
        setIsAuthenticated(true);
        setShowLogin(false);
        setMessage('');
        return true;
      } else {
        setMessage('密码错误，请重试');
        setMsgType('error');
        return false;
      }
    } catch (error) {
      setMessage('连接失败，请检查网络');
      setMsgType('error');
      return false;
    }
  };

  // 认证后的请求函数
  const authenticatedFetch = async (url, options = {}) => {
    const credentials = btoa(`admin:${password}`);
    const headers = {
      'Authorization': `Basic ${credentials}`,
      ...options.headers
    };
    
    return fetch(url, {
      ...options,
      headers
    });
  };

  // 处理登录
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setMessage('请输入密码');
      setMsgType('error');
      return;
    }
    
    await authenticate(password);
  };

  // 获取配置
  const fetchConfig = async () => {
    try {
      const response = await authenticatedFetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setFormData(data);
        setMessage('');
      } else if (response.status === 401) {
        setIsAuthenticated(false);
        setShowLogin(true);
        setMessage('认证失败，请重新登录');
        setMsgType('error');
      } else {
        setMessage('获取配置失败');
        setMsgType('error');
      }
    } catch (error) {
      setMessage('网络错误');
      setMsgType('error');
    }
  };

  // 提交配置
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setSuccess(false);
    
    try {
      const response = await authenticatedFetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setMessage('配置保存成功！');
        setMsgType('success');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else if (response.status === 401) {
        setIsAuthenticated(false);
        setShowLogin(true);
        setMessage('认证失败，请重新登录');
        setMsgType('error');
      } else {
        const errorData = await response.json();
        setMessage(errorData.detail || '保存失败');
        setMsgType('error');
      }
    } catch (error) {
      setMessage('网络错误');
      setMsgType('error');
    } finally {
      setLoading(false);
    }
  };

  // 处理输入变化
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? null : Number(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // ESC 键清空输入
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      const { name } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // 在认证成功后获取配置
  useEffect(() => {
    if (isAuthenticated) {
      fetchConfig();
    }
  }, [isAuthenticated]);

  // 如果未认证，显示登录界面
  if (showLogin) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f4f5f6',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: '20px',
        boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          {/* 标题 */}
          <h1 style={{
            fontSize: '18px',
            color: '#2c8af8',
            fontWeight: '700',
            margin: '0 0 20px 0',
            textShadow: '0 2px 6px rgba(44, 138, 248, 0.4)'
          }}>
            欢迎来到GPU管理器
          </h1>
          
          <div style={{
            fontSize: '13px',
            color: '#54759a',
            lineHeight: '1.6',
            marginBottom: '20px'
          }}>
            请注意，修改该配置项并不会修改你的 GPU 管理器配置文件，请确认修改后的外部控制地址和 GPU 管理器配置文件内的地址一致，否则会导致 GPU管理器界面 无法连接。
          </div>
            <form onSubmit={handleLogin}>
              {/* Host */}
              <div style={{
                marginBottom: '15px'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  color: '#24292e',
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  Host
                </label>
                <input
                  type="text"
                  value="10.82.1.223"
                  readOnly
                  className="input"
                  style={{
                    display: 'inline-block',
                    height: '30px',
                    width: '100%',
                    padding: '0 10px',
                    fontSize: '14px',
                    color: '#54759a',
                    borderRadius: '3px',
                    border: '1px solid #e4eaef',
                    transition: 'all 0.3s',
                    transitionProperty: 'borderColor,color,boxShadow',
                    backgroundColor: '#f8f9fa',
                    textAlign: 'center'
                  }}
                />
              </div>

              {/* 端口 */}
              <div style={{
                marginBottom: '15px'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  color: '#24292e',
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  端口
                </label>
                <input
                  type="text"
                  value="29214"
                  readOnly
                  className="input"
                  style={{
                    display: 'inline-block',
                    height: '30px',
                    width: '100%',
                    padding: '0 10px',
                    fontSize: '14px',
                    color: '#54759a',
                    borderRadius: '3px',
                    border: '1px solid #e4eaef',
                    transition: 'all 0.3s',
                    transitionProperty: 'borderColor,color,boxShadow',
                    backgroundColor: '#f8f9fa',
                    textAlign: 'center'
                  }}
                />
              </div>

              {/* 密钥 */}
              <div style={{
                marginBottom: '20px'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  color: '#24292e',
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  密钥
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  style={{
                    display: 'inline-block',
                    height: '30px',
                    width: '100%',
                    padding: '0 10px',
                    fontSize: '14px',
                    color: '#54759a',
                    borderRadius: '3px',
                    border: '1px solid #e4eaef',
                    transition: 'all 0.3s',
                    transitionProperty: 'borderColor,color,boxShadow',
                    backgroundColor: '#fff'
                  }}
                  placeholder="请输入密钥"
                  autoFocus
                  onFocus={(e) => {
                    e.target.style.outline = '0'
                    e.target.style.borderColor = '#57befc'
                    e.target.style.color = '#2c8af8'
                    e.target.style.boxShadow = '0 2px 5px rgba(87,190,252,0.5)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e4eaef'
                    e.target.style.color = '#54759a'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>

              {/* 连接按钮 */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '20px',
                paddingTop: '15px',
                borderTop: '1px solid #e4eaef'
              }}>
                <button
                  type="submit"
                  style={{
                    height: '30px',
                    padding: '0 15px',
                    color: '#fff',
                    fontSize: '12px',
                    lineHeight: '30px',
                    background: 'linear-gradient(135deg, #57befc, #2c8af8)',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    outline: 'none',
                    boxShadow: '0 2px 8px rgba(44,138,248,0.4)'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #2c8af8, #1e7ae6)'
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #57befc, #2c8af8)'
                  }}
                >
                  连接
                </button>
              </div>
            </form>

            {/* 错误消息 - clash-dashboard风格 */}
          {message && (
            <div style={{
              marginTop: '15px',
              padding: '15px',
              background: msgType === 'error' 
                ? 'linear-gradient(135deg, #f56c6c, #e74c3c)' 
                : 'linear-gradient(135deg, #3eb4fc, #57befc)',
              boxShadow: msgType === 'error' 
                ? '0 2px 8px rgba(245,108,108,0.3)' 
                : '0 2px 8px rgba(62,180,252,0.3)',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#fff',
              lineHeight: '1.6',
              textAlign: 'justify'
            }}>
              {message}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 主界面布局 - 仿clash-dashboard风格
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
      {/* 左侧边栏 - clash-dashboard风格 */}
      <div className="sidebar" style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
        width: '160px',
        userSelect: 'none',
        backgroundColor: '#fff'
      }}>
        {/* Logo */}
        <div style={{
          marginTop: '50px',
          width: '60px',
          height: '60px',
          backgroundColor: '#2c8af8',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '16px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(44, 138, 248, 0.5)'
        }}>
          GPU
        </div>

        {/* 菜单项 - clash-dashboard风格 */}
        <nav className="sidebar-menu" style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          marginTop: '12px'
        }}>
          <div className="item" style={{ marginTop: '18px' }}>
            <button
              onClick={() => setActiveTab('gpu')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '36px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                background: activeTab === 'gpu' ? 'linear-gradient(135deg, #57befc, #2c8af8)' : 'transparent',
                color: activeTab === 'gpu' ? '#fff' : '#909399',
                boxShadow: activeTab === 'gpu' ? '0 2px 8px rgba(44, 138, 248, 0.5)' : 'none'
              }}
            >
              GPU
            </button>
          </div>
          
          <div className="item" style={{ marginTop: '18px' }}>
            <button
              onClick={() => setActiveTab('commands')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '36px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                background: activeTab === 'commands' ? 'linear-gradient(135deg, #57befc, #2c8af8)' : 'transparent',
                color: activeTab === 'commands' ? '#fff' : '#909399',
                boxShadow: activeTab === 'commands' ? '0 2px 8px rgba(44, 138, 248, 0.5)' : 'none'
              }}
            >
              命令
            </button>
          </div>
          
          <div className="item" style={{ marginTop: '18px' }}>
            <button
              onClick={() => setActiveTab('logs')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '36px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                background: activeTab === 'logs' ? 'linear-gradient(135deg, #57befc, #2c8af8)' : 'transparent',
                color: activeTab === 'logs' ? '#fff' : '#909399',
                boxShadow: activeTab === 'logs' ? '0 2px 8px rgba(44, 138, 248, 0.5)' : 'none'
              }}
            >
              状态
            </button>
          </div>
          
          <div className="item" style={{ marginTop: '18px' }}>
            <button
              onClick={() => setActiveTab('rules')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '36px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                background: activeTab === 'rules' ? 'linear-gradient(135deg, #57befc, #2c8af8)' : 'transparent',
                color: activeTab === 'rules' ? '#fff' : '#909399',
                boxShadow: activeTab === 'rules' ? '0 2px 8px rgba(44, 138, 248, 0.5)' : 'none'
              }}
            >
              规则
            </button>
          </div>
          
          <div className="item" style={{ marginTop: '18px' }}>
            <button
              onClick={() => setActiveTab('settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '36px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                background: activeTab === 'settings' ? 'linear-gradient(135deg, #57befc, #2c8af8)' : 'transparent',
                color: activeTab === 'settings' ? '#fff' : '#909399',
                boxShadow: activeTab === 'settings' ? '0 2px 8px rgba(44, 138, 248, 0.5)' : 'none'
              }}
            >
              设置
            </button>
          </div>
        </nav>

        {/* 底部版本信息 - clash-dashboard风格 */}
        <div className="sidebar-version" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingBottom: '20px'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#2c8af8',
            textShadow: '0 2px 6px rgba(44, 138, 248, 0.4)'
          }}>
            GPU 管理器
          </div>
          <div style={{
            textAlign: 'center',
            fontSize: '14px',
            margin: '8px 0',
            padding: '0 10px',
            color: '#54759a'
          }}>
            v1.0.0
          </div>
        </div>
      </div>

      {/* 主内容区域 - clash-dashboard风格 */}
      <div className="page-container" style={{
        width: '100%',
        padding: '0 10px',
        height: 'calc(100vh - 60px)',
        marginLeft: '160px',
        WebkitOverflowScrolling: 'touch',
        overflowY: 'scroll',
        overflowX: 'hidden'
      }}>
        {/* GPU 监控页面 */}
        {activeTab === 'gpu' && (
          <div className="container" style={{
            width: '100%',
            margin: '20px 0'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h2 style={{
                fontSize: '18px',
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
            <GpuMonitor authenticatedFetch={authenticatedFetch} />
          </div>
        )}

        {/* 状态页面 */}
        {activeTab === 'logs' && (
          <div className="container" style={{
            width: '100%',
            margin: '20px 0'
          }}>
            <h2 style={{
              fontSize: '18px',
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
        )}

        {/* 规则页面 - clash-dashboard风格 */}
        {activeTab === 'rules' && (
          <div style={{
            width: '100%',
            height: '100%',
            padding: '20px',
            boxSizing: 'border-box'
          }}>
            {/* 页面标题 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <h2 style={{
                fontSize: '18px',
                color: '#2c8af8',
                margin: 0,
                fontWeight: '700',
                textShadow: '0 2px 6px rgba(44,138,248,0.4)'
              }}>
                GPU管理器实现规则
              </h2>
              
              {success && (
                <div style={{
                  padding: '8px 15px',
                  background: 'linear-gradient(135deg, #5dae34, #67c23a)',
                  boxShadow: '0 2px 8px rgba(93,174,52,0.3)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  ✓ 保存成功
                </div>
              )}
            </div>

            {message && (
              <div style={{
                marginBottom: '15px',
                padding: '15px',
                background: msgType === 'error' 
                  ? 'linear-gradient(135deg, #f56c6c, #e74c3c)' 
                  : 'linear-gradient(135deg, #3eb4fc, #57befc)',
                boxShadow: msgType === 'error' 
                  ? '0 2px 8px rgba(245,108,108,0.3)' 
                  : '0 2px 8px rgba(62,180,252,0.3)',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#fff',
                lineHeight: '1.6',
                textAlign: 'justify'
              }}>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{
                display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '20px',
                  marginBottom: '12px'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#24292e',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    check_time (调度间隔秒数)
                    <input
                      type="number"
                      name="check_time"
                      value={formData.check_time ?? ''}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      min={1}
                      required
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 12px',
                        border: '1px solid #e4eaef',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#24292e',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        marginTop: '4px',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#57befc'
                        e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e4eaef'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </label>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px',
                    color: '#24292e',
                    fontWeight: '500'
                  }}>
                    <input
                      type="checkbox"
                      name="maximize_resource_utilization"
                      checked={!!formData.maximize_resource_utilization}
                      onChange={handleChange}
                      style={{
                        marginRight: '8px',
                        width: '16px',
                        height: '16px'
                      }}
                    />
                    maximize_resource_utilization (极限利用资源模式)
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px',
                    color: '#24292e',
                    fontWeight: '500'
                  }}>
                    <input
                      type="checkbox"
                      name="memory_save_mode"
                      checked={!!formData.memory_save_mode}
                      onChange={handleChange}
                      style={{
                        marginRight: '8px',
                        width: '16px',
                        height: '16px'
                      }}
                    />
                    memory_save_mode (节省显存模式)
                  </div>

                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#24292e',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    compete_gpus (GPU 列表)
                    <input
                      type="text"
                      name="compete_gpus"
                      value={formData.compete_gpus ? JSON.stringify(formData.compete_gpus) : ''}
                      onChange={(e) => {
                        try {
                          const value = e.target.value;
                          if (value.trim() === '') {
                            handleChange({ target: { name: 'compete_gpus', value: [] } });
                          } else {
                            const parsed = JSON.parse(value);
                            handleChange({ target: { name: 'compete_gpus', value: parsed } });
                          }
                        } catch (error) {
                          // 忽略 JSON 解析错误
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="[0,1,2,3]"
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 12px',
                        border: '1px solid #e4eaef',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#24292e',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        marginTop: '4px',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#57befc'
                        e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e4eaef'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </label>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px',
                    color: '#24292e',
                    fontWeight: '500'
                  }}>
                    <input
                      type="checkbox"
                      name="use_all_gpus"
                      checked={!!formData.use_all_gpus}
                      onChange={handleChange}
                      style={{
                        marginRight: '8px',
                        width: '16px',
                        height: '16px'
                      }}
                    />
                    use_all_gpus (使用所有 GPU)
                  </div>

                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#24292e',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    gpu_left (保留 GPU 数量)
                    <input
                      type="number"
                      name="gpu_left"
                      value={formData.gpu_left ?? ''}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      min={0}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 12px',
                        border: '1px solid #e4eaef',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#24292e',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        marginTop: '4px',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#57befc'
                        e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e4eaef'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </label>

                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#24292e',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    min_gpu (最小 GPU 数量)
                    <input
                      type="number"
                      name="min_gpu"
                      value={formData.min_gpu ?? ''}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      min={0}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 12px',
                        border: '1px solid #e4eaef',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#24292e',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        marginTop: '4px',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#57befc'
                        e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e4eaef'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </label>

                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#24292e',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    max_gpu (最大 GPU 数量)
                    <input
                      type="number"
                      name="max_gpu"
                      value={formData.max_gpu ?? ''}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      min={0}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 12px',
                        border: '1px solid #e4eaef',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#24292e',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        marginTop: '4px',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#57befc'
                        e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e4eaef'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </label>

                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#24292e',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    work_dir (工作目录)
                    <input
                      type="text"
                      name="work_dir"
                      value={formData.work_dir ?? ''}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      placeholder="留空使用默认目录"
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 12px',
                        border: '1px solid #e4eaef',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#24292e',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        marginTop: '4px',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#57befc'
                        e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e4eaef'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </label>

                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#24292e',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    gpu_command_file (GPU 命令文件)
                    <input
                      type="text"
                      name="gpu_command_file"
                      value={formData.gpu_command_file ?? ''}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 12px',
                        border: '1px solid #e4eaef',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#24292e',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        marginTop: '4px',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#57befc'
                        e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e4eaef'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </label>

                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#24292e',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    gpus_command_file (多 GPU 命令文件)
                    <input
                      type="text"
                      name="gpus_command_file"
                      value={formData.gpus_command_file ?? ''}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 12px',
                        border: '1px solid #e4eaef',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#24292e',
                        backgroundColor: '#fff',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        marginTop: '4px',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#57befc'
                        e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e4eaef'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </label>
                </div>

                {/* 重试配置区域 - clash-dashboard风格 */}
                <div style={{
                  marginTop: '20px',
                  paddingTop: '15px',
                  borderTop: '1px solid #e4eaef'
                }}>
                  <div style={{
                    fontSize: '14px',
                    color: '#2c8af8',
                    fontWeight: '700',
                    marginBottom: '15px'
                  }}>
                    重试配置
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '20px'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      color: '#24292e',
                      marginBottom: '8px',
                      fontWeight: '500'
                    }}>
                      max_retry_before_backoff (退避前重试次数)
                      <input
                        type="number"
                        name="retry_config.max_retry_before_backoff"
                        value={formData.retry_config?.max_retry_before_backoff ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : Number(e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            retry_config: {
                              ...prev.retry_config,
                              max_retry_before_backoff: value
                            }
                          }));
                        }}
                        onKeyDown={handleKeyDown}
                        min={0}
                        style={{
                          width: '100%',
                          height: '36px',
                          padding: '0 12px',
                          border: '1px solid #e4eaef',
                          borderRadius: '4px',
                          fontSize: '14px',
                          color: '#24292e',
                          backgroundColor: '#fff',
                          transition: 'all 0.3s ease',
                          outline: 'none',
                          marginTop: '4px',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#57befc'
                          e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e4eaef'
                          e.target.style.boxShadow = 'none'
                        }}
                      />
                    </label>

                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      color: '#24292e',
                      marginBottom: '8px',
                      fontWeight: '500'
                    }}>
                      backoff_duration (退避时间，秒)
                      <input
                        type="number"
                        name="retry_config.backoff_duration"
                        value={formData.retry_config?.backoff_duration ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : Number(e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            retry_config: {
                              ...prev.retry_config,
                              backoff_duration: value
                            }
                          }));
                        }}
                        onKeyDown={handleKeyDown}
                        min={0}
                        style={{
                          width: '100%',
                          height: '36px',
                          padding: '0 12px',
                          border: '1px solid #e4eaef',
                          borderRadius: '4px',
                          fontSize: '14px',
                          color: '#24292e',
                          backgroundColor: '#fff',
                          transition: 'all 0.3s ease',
                          outline: 'none',
                          marginTop: '4px',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#57befc'
                          e.target.style.boxShadow = '0 0 0 2px rgba(87, 190, 252, 0.2)'
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#e4eaef'
                          e.target.style.boxShadow = 'none'
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* 按钮区域 - clash-dashboard风格 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '20px',
                  paddingTop: '15px',
                  borderTop: '1px solid #e4eaef'
                }}>
                  <button
                    type="button"
                    onClick={fetchConfig}
                    style={{
                      height: '30px',
                      padding: '0 15px',
                      color: '#54759a',
                      fontSize: '12px',
                      lineHeight: '30px',
                      background: '#fff',
                      border: '1px solid #e4eaef',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      outline: 'none'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.borderColor = '#57befc'
                      e.target.style.color = '#2c8af8'
                    }}
                    onMouseOut={(e) => {
                      e.target.style.borderColor = '#e4eaef'
                      e.target.style.color = '#54759a'
                    }}
                  >
                    重置
                  </button>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      height: '30px',
                      padding: '0 15px',
                      color: '#fff',
                      fontSize: '12px',
                      lineHeight: '30px',
                      background: loading ? '#b7c5d6' : 'linear-gradient(135deg, #57befc, #2c8af8)',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      boxShadow: loading ? 'none' : '0 2px 8px rgba(44,138,248,0.4)'
                    }}
                  >
                    {loading ? '保存中...' : '保存配置'}
                  </button>
                </div>
              </form>
          </div>
        )}

        {/* 命令配置页面 */}
        {activeTab === 'commands' && (
          <div className="container" style={{
            width: '100%',
            margin: '20px 0'
          }}>
            <CommandManager authenticatedFetch={authenticatedFetch} />
          </div>
        )}

        {/* 设置页面 */}
        {activeTab === 'settings' && (
          <div style={{
            width: '100%',
            height: '100%',
            padding: '20px',
            boxSizing: 'border-box'
          }}>
            {/* 页面标题 */}
            <h2 style={{
              fontSize: '18px',
              color: '#2c8af8',
              margin: '0 0 20px 0',
              fontWeight: '700',
              textShadow: '0 2px 6px rgba(44,138,248,0.4)'
            }}>
              系统设置
            </h2>
            
            <SystemSettings authenticatedFetch={authenticatedFetch} />
          </div>
        )}
      </div>
    </div>
  );
}

// 命令管理组件
const CommandManager = ({ authenticatedFetch }) => {
  const [mode, setMode] = useState('single'); // 'single' 或 'multi'
  const [config, setConfig] = useState({ queues: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expandedQueues, setExpandedQueues] = useState(new Set());
  const [expandedProcesses, setExpandedProcesses] = useState(new Set());

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authenticatedFetch(`/api/commands/${mode}`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else {
        setError('加载配置失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, mode]);

  // 保存配置
  const saveConfig = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await authenticatedFetch(`/api/commands/${mode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('保存成功:', data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || '保存失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [authenticatedFetch, mode, config]);

  // 添加新队列
  const addQueue = useCallback(() => {
    const newQueue = {
      id: Math.max(0, ...config.queues.map(q => q.id)) + 1,
      processes: [{
        id: 1,
        commands: [''],
        gpu_count: 1,
        memory: 20
      }]
    };
    setConfig(prev => ({
      ...prev,
      queues: [...prev.queues, newQueue]
    }));
    setExpandedQueues(prev => new Set(prev).add(newQueue.id));
    setExpandedProcesses(prev => new Set(prev).add(`${newQueue.id}-1`));
  }, [config.queues]);

  // 删除队列
  const deleteQueue = useCallback((queueId) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.filter(q => q.id !== queueId)
    }));
    setExpandedQueues(prev => {
      const newSet = new Set(prev);
      newSet.delete(queueId);
      return newSet;
    });
  }, []);

  // 添加新进程
  const addProcess = useCallback((queueId) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => {
        if (queue.id === queueId) {
          const newProcessId = Math.max(0, ...queue.processes.map(p => p.id)) + 1;
          return {
            ...queue,
            processes: [...queue.processes, {
              id: newProcessId,
              commands: [''],
              gpu_count: 1,
              memory: 20
            }]
          };
        }
        return queue;
      })
    }));
    setExpandedProcesses(prev => new Set(prev).add(`${queueId}-${Math.max(0, ...config.queues.find(q => q.id === queueId)?.processes.map(p => p.id) || [0]) + 1}`));
  }, [config.queues]);

  // 删除进程
  const deleteProcess = useCallback((queueId, processId) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => {
        if (queue.id === queueId) {
          return {
            ...queue,
            processes: queue.processes.filter(p => p.id !== processId)
          };
        }
        return queue;
      })
    }));
    setExpandedProcesses(prev => {
      const newSet = new Set(prev);
      newSet.delete(`${queueId}-${processId}`);
      return newSet;
    });
  }, []);

  // 更新进程
  const updateProcess = useCallback((queueId, processId, field, value) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => {
        if (queue.id === queueId) {
          return {
            ...queue,
            processes: queue.processes.map(process => 
              process.id === processId 
                ? { ...process, [field]: value }
                : process
            )
          };
        }
        return queue;
      })
    }));
  }, []);

  // 更新命令
  const updateCommand = useCallback((queueId, processId, commandIndex, value) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => {
        if (queue.id === queueId) {
          return {
            ...queue,
            processes: queue.processes.map(process => 
              process.id === processId 
                ? {
                    ...process,
                    commands: process.commands.map((cmd, idx) => 
                      idx === commandIndex ? value : cmd
                    )
                  }
                : process
            )
          };
        }
        return queue;
      })
    }));
  }, []);

  // 添加命令
  const addCommand = useCallback((queueId, processId) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => {
        if (queue.id === queueId) {
          return {
            ...queue,
            processes: queue.processes.map(process => 
              process.id === processId 
                ? { ...process, commands: [...process.commands, ''] }
                : process
            )
          };
        }
        return queue;
      })
    }));
  }, []);

  // 删除命令
  const deleteCommand = useCallback((queueId, processId, commandIndex) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => {
        if (queue.id === queueId) {
          return {
            ...queue,
            processes: queue.processes.map(process => 
              process.id === processId 
                ? {
                    ...process,
                    commands: process.commands.filter((_, idx) => idx !== commandIndex)
                  }
                : process
            )
          };
        }
        return queue;
      })
    }));
  }, []);

  // 切换队列展开状态
  const toggleQueueExpanded = useCallback((queueId) => {
    setExpandedQueues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(queueId)) {
        newSet.delete(queueId);
      } else {
        newSet.add(queueId);
      }
      return newSet;
    });
  }, []);

  // 切换进程展开状态
  const toggleProcessExpanded = useCallback((queueId, processId) => {
    const key = `${queueId}-${processId}`;
    setExpandedProcesses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  // 重置配置
  const resetConfig = useCallback(async () => {
    if (!window.confirm('确定要重置配置吗？此操作将恢复到备份文件的原始配置，所有未保存的更改将丢失。')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const response = await authenticatedFetch(`/api/commands/${mode}/reset`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('重置成功:', data);
        // 重新加载配置
        await loadConfig();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || '重置失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, mode, loadConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px',
        color: '#6b7280'
      }}>
        加载中...
      </div>
    );
  }

  return (
    <div>
      {/* 页面标题和模式切换 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h2 style={{
          fontSize: '18px',
          color: '#2c8af8',
          margin: 0,
          fontWeight: '700',
          textShadow: '0 2px 6px rgba(44,138,248,0.4)'
        }}>
          命令配置管理
        </h2>
        
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={() => setMode('single')}
            style={{
              padding: '8px 16px',
              backgroundColor: mode === 'single' ? '#2c8af8' : '#f3f4f6',
              color: mode === 'single' ? '#fff' : '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            进程单卡运行
          </button>
          <button
            onClick={() => setMode('multi')}
            style={{
              padding: '8px 16px',
              backgroundColor: mode === 'multi' ? '#2c8af8' : '#f3f4f6',
              color: mode === 'multi' ? '#fff' : '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            进程多卡运行
          </button>
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '12px',
          color: '#dc2626',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={addQueue}
            style={{
              backgroundColor: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            + 添加队列
          </button>
          
          <button
            onClick={saveConfig}
            disabled={saving}
            style={{
              backgroundColor: saving ? '#9ca3af' : '#2c8af8',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          
          <button
            onClick={resetConfig}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#9ca3af' : '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            重置
          </button>
        </div>
        
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#6b7280'
          }}>
            {config.queues.length} 个队列
          </div>
          
          <button
            onClick={() => {
              // TODO: 实现运行命令逻辑
              console.log('运行命令功能待实现');
            }}
            style={{
              backgroundColor: '#ec4899',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            运行
          </button>
        </div>
      </div>

      {/* 队列列表 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {config.queues.map((queue) => (
          <QueueCard
            key={queue.id}
            queue={queue}
            mode={mode}
            isExpanded={expandedQueues.has(queue.id)}
            onToggleExpand={() => toggleQueueExpanded(queue.id)}
            onUpdate={updateProcess}
            onDelete={deleteQueue}
            onAddProcess={addProcess}
            onUpdateProcess={updateProcess}
            onDeleteProcess={deleteProcess}
            onUpdateCommand={updateCommand}
            onAddCommand={addCommand}
            onDeleteCommand={deleteCommand}
            expandedProcesses={expandedProcesses}
            onToggleProcess={toggleProcessExpanded}
          />
        ))}
        
        {config.queues.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            暂无队列配置，点击"添加队列"开始配置
          </div>
        )}
      </div>
    </div>
  );
};

// 队列卡片组件
const QueueCard = ({ 
  queue, 
  mode, 
  isExpanded, 
  onToggleExpand, 
  onUpdate, 
  onDelete, 
  onAddProcess,
  onUpdateProcess,
  onDeleteProcess,
  onUpdateCommand,
  onAddCommand,
  onDeleteCommand,
  expandedProcesses,
  onToggleProcess
}) => {
  const processes = queue.processes || [];
  
  return (
    <div style={{
      backgroundColor: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* 队列头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 8px',
        backgroundColor: '#f9fafb',
        borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
        minHeight: '48px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button
            onClick={onToggleExpand}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              color: '#6b7280',
              transition: 'transform 0.2s ease',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}
          >
            ▶
          </button>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              backgroundColor: '#2c8af8',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              队列 {queue.id}
            </span>
            
            <span style={{
              fontSize: '14px',
              color: '#6b7280'
            }}>
              {processes.length} 个进程
            </span>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={() => onAddProcess(queue.id)}
            style={{
              backgroundColor: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            + 添加进程
          </button>
          
          <button
            onClick={() => onDelete(queue.id)}
            style={{
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            删除队列
          </button>
        </div>
      </div>
      
      {/* 队列内容 - 进程列表 */}
      {isExpanded && (
        <div style={{
          padding: '16px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {processes.map((process, index) => (
              <ProcessCard
                key={process.id}
                queueId={queue.id}
                process={process}
                processIndex={index}
                mode={mode}
                isExpanded={expandedProcesses.has(`${queue.id}-${process.id}`)}
                onToggleExpand={() => onToggleProcess(queue.id, process.id)}
                onUpdate={onUpdateProcess}
                onDelete={onDeleteProcess}
                onUpdateCommand={onUpdateCommand}
                onAddCommand={onAddCommand}
                onDeleteCommand={onDeleteCommand}
              />
            ))}
            
            {processes.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#6b7280',
                fontSize: '14px',
                border: '1px dashed #d1d5db',
                borderRadius: '4px'
              }}>
                暂无进程，点击"添加进程"开始配置
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 进程卡片组件
const ProcessCard = ({
  queueId,
  process,
  processIndex,
  mode,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onUpdateCommand,
  onAddCommand,
  onDeleteCommand
}) => {
  return (
    <div style={{
      backgroundColor: '#f8fafc',
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      overflow: 'hidden'
    }}>
      {/* 进程头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: '#f1f5f9',
        borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button
            onClick={onToggleExpand}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer',
              color: '#6b7280',
              transition: 'transform 0.2s ease',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}
          >
            ▶
          </button>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              backgroundColor: '#10b981',
              color: '#fff',
              padding: '1px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              进程 {process.id}
            </span>
            
            <span style={{
              fontSize: '12px',
              color: '#6b7280'
            }}>
              {process.commands?.length || 0} 个命令
            </span>
            
            {mode === 'multi' && (
              <span style={{
                fontSize: '12px',
                color: '#6b7280'
              }}>
                {process.gpu_count || 1} GPU
              </span>
            )}
            
            <span style={{
              fontSize: '12px',
              color: '#6b7280'
            }}>
              {process.memory || 20}GB
            </span>
          </div>
        </div>
        
        <button
          onClick={() => onDelete(queueId, process.id)}
          style={{
            backgroundColor: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            padding: '2px 6px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          删除
        </button>
      </div>
      
      {/* 进程内容 */}
      {isExpanded && (
        <div style={{
          padding: '12px'
        }}>
          {/* GPU数量（仅多卡模式） */}
          {mode === 'multi' && (
            <div style={{
              marginBottom: '12px'
            }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '2px'
              }}>
                GPU数量需求
              </label>
              <input
                type="number"
                min="1"
                value={process.gpu_count || 1}
                onChange={(e) => onUpdate(queueId, process.id, 'gpu_count', parseInt(e.target.value) || 1)}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #d1d5db',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}
              />
            </div>
          )}
          
          {/* 显存需求 */}
          <div style={{
            marginBottom: '12px'
          }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '2px'
            }}>
              显存需求 (GB)
            </label>
            <input
              type="number"
              min="1"
              value={process.memory || 20}
              onChange={(e) => onUpdate(queueId, process.id, 'memory', parseInt(e.target.value) || 20)}
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid #d1d5db',
                borderRadius: '3px',
                fontSize: '12px'
              }}
            />
          </div>
          
          {/* 命令列表 */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <label style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#374151'
              }}>
                命令列表
              </label>
              <button
                onClick={() => onAddCommand(queueId, process.id)}
                style={{
                  backgroundColor: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                + 添加命令
              </button>
            </div>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {(process.commands || []).map((command, index) => (
                <div key={index} style={{
                  display: 'flex',
                  gap: '6px'
                }}>
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => onUpdateCommand(queueId, process.id, index, e.target.value)}
                    placeholder="输入命令..."
                    style={{
                      flex: 1,
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                  />
                  {(process.commands || []).length > 1 && (
                    <button
                      onClick={() => onDeleteCommand(queueId, process.id, index)}
                      style={{
                        backgroundColor: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
