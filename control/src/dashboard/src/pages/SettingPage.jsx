import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const SettingPage = () => {
  const { authenticatedFetch } = useAuth();
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

  const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: '1px solid #f0f0f0',
    width: '100%'
  };

  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px 30px',
    marginBottom: '24px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '120px',
    rowGap: '0'
  };

  const labelStyle = {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500',
    flex: 1
  };
  
  const descStyle = {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px'
  };

  const inputStyle = {
    width: '200px',
    height: '32px',
    padding: '0 8px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    textAlign: 'left',
    outline: 'none',
    transition: 'all 0.3s',
    backgroundColor: '#fff'
  };

  const selectStyle = {
    width: '200px',
    height: '32px',
    padding: '0 8px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fff',
    textAlign: 'left'
  };

  const checkboxStyle = {
    width: '44px',
    height: '24px',
    position: 'relative',
    appearance: 'none',
    backgroundColor: '#e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
    border: 'none',
    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div className="container" style={{ width: '97%', margin: '20px auto' }}>
      <h2 style={{
        fontSize: '24px',
        color: '#2c8af8',
        margin: '0 0 30px 0',
        fontWeight: '700'
      }}>
        系统设置
      </h2>

      {success && (
        <div style={{
          marginBottom: '15px',
          padding: '12px',
          background: '#e6f7ff',
          border: '1px solid #91d5ff',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#1890ff'
        }}>
          ✓ 设置保存成功
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{
          marginBottom: '15px',
          padding: '12px',
          background: '#fffbe6',
          border: '1px solid #ffe58f',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#faad14'
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
          padding: '12px',
          background: '#fff2f0',
          border: '1px solid #ffccc7',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#ff4d4f'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', color: '#999', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' }}>通用</h3>
          
          <div style={gridStyle}>
            {/* target-yaml-path */}
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>配置路径</div>
                <div style={descStyle}>{settings['target-yaml-path']?.description}</div>
              </div>
              <input
                type="text"
                value={settings['target-yaml-path']?.value || ''}
                onChange={(e) => handleChange('target-yaml-path', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* log-dir */}
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>日志目录</div>
                <div style={descStyle}>{settings['log-dir']?.description}</div>
              </div>
              <input
                type="text"
                value={settings['log-dir']?.value || ''}
                onChange={(e) => handleChange('log-dir', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            {/* log-level */}
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>日志级别</div>
                <div style={descStyle}>{settings['log-level']?.description}</div>
              </div>
              <select
                value={settings['log-level']?.value || ''}
                onChange={(e) => handleChange('log-level', e.target.value)}
                style={selectStyle}
              >
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="error">error</option>
                <option value="critical">critical</option>
              </select>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', color: '#999', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' }}>网络</h3>
          
          <div style={gridStyle}>
            {/* port */}
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>端口</div>
                <div style={descStyle}>
                  {settings['port']?.description}
                  {settings['port']?.requires_restart && <span style={{ color: '#faad14', marginLeft: '5px' }}>⚠️ 重启生效</span>}
                </div>
              </div>
              <input
                type="number"
                value={settings['port']?.value || ''}
                onChange={(e) => handleChange('port', parseInt(e.target.value) || '')}
                min={1} max={65535}
                style={inputStyle}
              />
            </div>

            {/* bind-address */}
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>绑定地址</div>
                <div style={descStyle}>
                  {settings['bind-address']?.description}
                  {settings['bind-address']?.requires_restart && <span style={{ color: '#faad14', marginLeft: '5px' }}>⚠️ 重启生效</span>}
                </div>
              </div>
              <select
                value={settings['bind-address']?.value || ''}
                onChange={(e) => handleChange('bind-address', e.target.value)}
                style={selectStyle}
              >
                <option value="0.0.0.0">0.0.0.0 (所有接口)</option>
                <option value="127.0.0.1">127.0.0.1 (仅本地)</option>
                <option value="localhost">localhost (仅本地)</option>
              </select>
            </div>

            {/* allow-lan */}
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>允许局域网访问</div>
                <div style={descStyle}>{settings['allow-lan']?.description}</div>
              </div>
               <div style={{ position: 'relative' }}>
                 <input 
                  type="checkbox" 
                  checked={!!settings['allow-lan']?.value}
                  onChange={(e) => handleChange('allow-lan', e.target.checked)}
                  style={checkboxStyle}
                  className="switch-checkbox"
                />
                <style>{`
                  .switch-checkbox { 
                    background-color: #e5e7eb !important; 
                    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
                  }
                  .switch-checkbox:hover {
                    background-color: #d1d5db !important;
                  }
                  .switch-checkbox:checked { 
                    background-color: #2c8af8 !important; 
                    box-shadow: 0 2px 8px rgba(44, 138, 248, 0.3);
                  }
                  .switch-checkbox:checked:hover {
                    background-color: #2576d4 !important;
                    box-shadow: 0 2px 10px rgba(44, 138, 248, 0.4);
                  }
                  .switch-checkbox::before {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 20px;
                    height: 20px;
                    background: #ffffff;
                    border-radius: 50%;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1);
                  }
                  .switch-checkbox:checked::before { 
                    transform: translateX(20px); 
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
                  }
                `}</style>
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', color: '#999', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' }}>安全</h3>
          
          <div style={gridStyle}>
            {/* secret */}
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>访问密钥</div>
                <div style={descStyle}>{settings['secret']?.description}</div>
              </div>
              <input
                type="password"
                value={settings['secret']?.value || ''}
                onChange={(e) => handleChange('secret', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* 底部按钮固定 */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: '160px', // Sidebar width
          right: 0,
          padding: '16px 40px',
          backgroundColor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid #eaeaea',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          zIndex: 10
        }}>
          <button
            type="button"
            onClick={fetchSettings}
            disabled={saving}
            style={{
              height: '36px', padding: '0 20px', color: '#666',
              fontSize: '14px', background: 'transparent',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.color = '#333'}
            onMouseOut={(e) => e.target.style.color = '#666'}
          >
            重置修改
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              height: '36px', padding: '0 24px', color: '#fff',
              fontSize: '14px', fontWeight: '500',
              background: '#2c8af8',
              border: 'none', borderRadius: '18px',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(44,138,248,0.3)'
            }}
            onMouseOver={(e) => !saving && (e.target.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => !saving && (e.target.style.transform = 'translateY(0)')}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>

        {/* 底部留白 */}
        <div style={{ height: '60px' }}></div>
      </form>
    </div>
  );
};

export default SettingPage;
