import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const RulePage = () => {
  const { authenticatedFetch } = useAuth();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('error');
  const [success, setSuccess] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setFormData(data);
        setMessage('');
      } else {
        setMessage('获取配置失败');
        setMsgType('error');
      }
    } catch (error) {
      setMessage('网络错误');
      setMsgType('error');
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setSuccess(false);
    
    try {
      const response = await authenticatedFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setMessage('配置保存成功！');
        setMsgType('success');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? null : Number(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      const { name } = e.target;
      setFormData(prev => ({ ...prev, [name]: '' }));
    }
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
        <h2 style={{
          fontSize: '24px',
          color: '#2c8af8',
          margin: 0,
          fontWeight: '700'
        }}>
          规则配置
        </h2>
        
        {success && (
          <div style={{ color: '#52c41a', fontSize: '14px', fontWeight: '500' }}>
            ✓ 已保存
          </div>
        )}
      </div>

      {message && !success && (
        <div style={{
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: msgType === 'error' ? '#fff2f0' : '#e6f7ff',
          border: `1px solid ${msgType === 'error' ? '#ffccc7' : '#91d5ff'}`,
          borderRadius: '4px',
          color: msgType === 'error' ? '#ff4d4f' : '#1890ff',
          fontSize: '14px'
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 基础配置 */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', color: '#999', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' }}>基础设置</h3>
          
          <div style={gridStyle}>
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>调度间隔</div>
                <div style={descStyle}>check_time (秒)</div>
              </div>
              <input type="number" name="check_time" value={formData.check_time ?? ''} onChange={handleChange}
                onKeyDown={handleKeyDown} min={1} required style={inputStyle} />
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>保留 GPU</div>
                <div style={descStyle}>gpu_left (数量)</div>
              </div>
              <input type="number" name="gpu_left" value={formData.gpu_left ?? ''} onChange={handleChange}
                onKeyDown={handleKeyDown} min={0} style={inputStyle} />
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>最小 GPU 数量</div>
                <div style={descStyle}>min_gpu</div>
              </div>
              <input type="number" name="min_gpu" value={formData.min_gpu ?? ''} onChange={handleChange}
                onKeyDown={handleKeyDown} min={0} style={inputStyle} />
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>最大 GPU 数量</div>
                <div style={descStyle}>max_gpu</div>
              </div>
              <input type="number" name="max_gpu" value={formData.max_gpu ?? ''} onChange={handleChange}
                onKeyDown={handleKeyDown} min={0} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* 模式开关 */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', color: '#999', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' }}>模式选择</h3>
          
          <div style={gridStyle}>
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>极限资源利用</div>
                <div style={descStyle}>maximize_resource_utilization</div>
              </div>
              <div style={{ position: 'relative' }}>
                 <input 
                  type="checkbox" 
                  name="maximize_resource_utilization" 
                  checked={!!formData.maximize_resource_utilization}
                  onChange={handleChange} 
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

            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>节省显存模式</div>
                <div style={descStyle}>memory_save_mode</div>
              </div>
              <div style={{ position: 'relative' }}>
                 <input 
                  type="checkbox" 
                  name="memory_save_mode" 
                  checked={!!formData.memory_save_mode}
                  onChange={handleChange} 
                  style={checkboxStyle}
                  className="switch-checkbox"
                />
              </div>
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>使用所有 GPU</div>
                <div style={descStyle}>use_all_gpus</div>
              </div>
              <div style={{ position: 'relative' }}>
                 <input 
                  type="checkbox" 
                  name="use_all_gpus" 
                  checked={!!formData.use_all_gpus}
                  onChange={handleChange} 
                  style={checkboxStyle}
                  className="switch-checkbox"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 高级配置 */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', color: '#999', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' }}>高级配置</h3>
          
          <div style={gridStyle}>
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>GPU 列表</div>
                <div style={descStyle}>compete_gpus (例如: [0,1,2])</div>
              </div>
              <input type="text" name="compete_gpus"
                value={formData.compete_gpus ? JSON.stringify(formData.compete_gpus) : ''}
                onChange={(e) => {
                  try {
                    const value = e.target.value;
                    if (value.trim() === '') {
                      setFormData(prev => ({ ...prev, compete_gpus: [] }));
                    } else {
                      const parsed = JSON.parse(value);
                      setFormData(prev => ({ ...prev, compete_gpus: parsed }));
                    }
                  } catch (error) {}
                }}
                onKeyDown={handleKeyDown} placeholder="[]" style={inputStyle} />
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>工作目录</div>
                <div style={descStyle}>work_dir</div>
              </div>
              <input type="text" name="work_dir" value={formData.work_dir ?? ''} onChange={handleChange}
                onKeyDown={handleKeyDown} placeholder="默认" style={inputStyle} />
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>GPU 命令文件</div>
                <div style={descStyle}>gpu_command_file</div>
              </div>
              <input type="text" name="gpu_command_file" value={formData.gpu_command_file ?? ''} onChange={handleChange}
                onKeyDown={handleKeyDown} style={inputStyle} />
            </div>

             <div style={itemStyle}>
              <div style={labelStyle}>
                <div>多 GPU 命令文件</div>
                <div style={descStyle}>gpus_command_file</div>
              </div>
              <input type="text" name="gpus_command_file" value={formData.gpus_command_file ?? ''} onChange={handleChange}
                onKeyDown={handleKeyDown} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* 重试配置 */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', color: '#999', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' }}>重试机制</h3>
          
          <div style={gridStyle}>
            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>退避前重试次数</div>
                <div style={descStyle}>max_retry_before_backoff</div>
              </div>
              <input type="number" name="retry_config.max_retry_before_backoff"
                  value={formData.retry_config?.max_retry_before_backoff ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : Number(e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      retry_config: { ...prev.retry_config, max_retry_before_backoff: value }
                    }));
                  }}
                  onKeyDown={handleKeyDown} min={0} style={inputStyle} />
            </div>

            <div style={itemStyle}>
              <div style={labelStyle}>
                <div>退避时间</div>
                <div style={descStyle}>backoff_duration (秒)</div>
              </div>
              <input type="number" name="retry_config.backoff_duration"
                  value={formData.retry_config?.backoff_duration ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : Number(e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      retry_config: { ...prev.retry_config, backoff_duration: value }
                    }));
                  }}
                  onKeyDown={handleKeyDown} min={0} style={inputStyle} />
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
          <button type="button" onClick={fetchConfig}
            style={{
              height: '36px', padding: '0 20px', color: '#666',
              fontSize: '14px', background: 'transparent',
              border: 'none',
              cursor: 'pointer', transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.color = '#333'}
            onMouseOut={(e) => e.target.style.color = '#666'}
          >
            重置修改
          </button>
          
          <button type="submit" disabled={loading}
            style={{
              height: '36px', padding: '0 24px', color: '#fff',
              fontSize: '14px', fontWeight: '500',
              background: '#2c8af8',
              border: 'none', borderRadius: '18px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(44,138,248,0.3)'
            }}
            onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
          >
            {loading ? '保存中...' : '保存配置'}
          </button>
        </div>
        
        {/* 底部留白，防止内容被按钮遮挡 */}
        <div style={{ height: '60px' }}></div>
      </form>
    </div>
  );
};

export default RulePage;
