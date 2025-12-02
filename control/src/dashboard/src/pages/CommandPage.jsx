import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// 进程卡片组件
const ProcessCard = ({
  configIndex, queueId, process, mode, isExpanded, onToggleExpand,
  onUpdate, onDelete, onUpdateCommand, onAddCommand, onDeleteCommand,
  showLogBinding, logBindings, onBindLog, onUnbindLog
}) => {
  const bindingKey = `${mode === 'single' ? 'single' : 'multi'}_${configIndex}_${queueId}_${process.id - 1}`;
  const bindingInfo = logBindings?.[bindingKey];
  const currentBinding = bindingInfo?.log_path || null;
  const [logPath, setLogPath] = useState('');
  
  // 当绑定信息变化时更新输入框
  useEffect(() => {
    if (currentBinding) {
      setLogPath(currentBinding);
    }
  }, [currentBinding]);

  return (
    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px', backgroundColor: '#f1f5f9',
        borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={onToggleExpand} style={{
            backgroundColor: 'transparent', border: 'none', fontSize: '14px',
            cursor: 'pointer', color: '#6b7280', transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>▶</button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ backgroundColor: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' }}>
              进程 {process.id}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{process.commands?.length || 0} 个命令</span>
            {mode === 'multi' && <span style={{ fontSize: '12px', color: '#6b7280' }}>{process.gpu_count || 1} GPU</span>}
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{process.memory || 20}GB</span>
            {currentBinding && (
              <span style={{ fontSize: '11px', color: '#10b981' }}>📋 已绑定日志</span>
            )}
          </div>
        </div>
        
        <button onClick={() => onDelete(configIndex, queueId, process.id)} style={{
          backgroundColor: '#ef4444', color: '#fff', border: 'none',
          borderRadius: '3px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer'
        }}>删除</button>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '12px' }}>
          {mode === 'multi' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '2px' }}>GPU数量需求</label>
              <input type="number" min="1" value={process.gpu_count || 1}
                onChange={(e) => onUpdate(configIndex, queueId, process.id, 'gpu_count', parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '3px', fontSize: '12px' }} />
            </div>
          )}
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '2px' }}>显存需求 (GB)</label>
            <input type="number" min="1" value={process.memory || 20}
              onChange={(e) => onUpdate(configIndex, queueId, process.id, 'memory', parseInt(e.target.value) || 20)}
              style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '3px', fontSize: '12px' }} />
          </div>
          
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>命令列表</label>
              <button onClick={() => onAddCommand(configIndex, queueId, process.id)} style={{
                backgroundColor: '#10b981', color: '#fff', border: 'none',
                borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer'
              }}>+ 添加命令</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(process.commands || []).map((command, index) => (
                <div key={index} style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" value={command}
                    onChange={(e) => onUpdateCommand(configIndex, queueId, process.id, index, e.target.value)}
                    placeholder="输入命令..."
                    style={{ flex: 1, padding: '6px', border: '1px solid #d1d5db', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' }} />
                  {(process.commands || []).length > 1 && (
                    <button onClick={() => onDeleteCommand(configIndex, queueId, process.id, index)} style={{
                      backgroundColor: '#ef4444', color: '#fff', border: 'none',
                      borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer'
                    }}>删除</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* 日志绑定 */}
          {showLogBinding && (
            <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #bae6fd' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#0369a1', marginBottom: '6px' }}>
                📋 日志绑定 (可选)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input 
                  type="text" 
                  value={logPath}
                  onChange={(e) => setLogPath(e.target.value)}
                  placeholder="输入日志文件的绝对路径..."
                  style={{ flex: 1, padding: '6px', border: '1px solid #d1d5db', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' }} 
                />
                <button 
                  type="button"
                  onClick={(e) => { e.preventDefault(); onBindLog(mode === 'single' ? 'single' : 'multi', configIndex, queueId, process.id - 1, logPath); }}
                  disabled={!logPath}
                  style={{
                    backgroundColor: logPath ? '#2c8af8' : '#9ca3af', color: '#fff', border: 'none',
                    borderRadius: '3px', padding: '4px 10px', fontSize: '11px', cursor: logPath ? 'pointer' : 'not-allowed'
                  }}
                >绑定</button>
                {currentBinding && (
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); onUnbindLog(mode === 'single' ? 'single' : 'multi', configIndex, queueId, process.id - 1); setLogPath(''); }}
                    style={{
                      backgroundColor: '#ef4444', color: '#fff', border: 'none',
                      borderRadius: '3px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer'
                    }}
                  >解绑</button>
                )}
              </div>
              {currentBinding && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#10b981' }}>
                  当前绑定: {currentBinding}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 队列卡片组件
const QueueCard = ({ 
  configIndex, queue, mode, isExpanded, onToggleExpand, onDelete, onAddProcess,
  onUpdateProcess, onDeleteProcess, onUpdateCommand, onAddCommand, onDeleteCommand,
  expandedProcesses, onToggleProcess,
  showLogBinding, logBindings, onBindLog, onUnbindLog
}) => {
  const processes = queue.processes || [];
  
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginLeft: '20px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 8px', backgroundColor: '#f9fafb',
        borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none', minHeight: '40px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={onToggleExpand} style={{
            backgroundColor: 'transparent', border: 'none', fontSize: '14px',
            cursor: 'pointer', color: '#6b7280', transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>▶</button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: '#2c8af8', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              队列 {queue.id}
            </span>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>{processes.length} 个进程</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onAddProcess(configIndex, queue.id)} style={{
            backgroundColor: '#10b981', color: '#fff', border: 'none',
            borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer'
          }}>+ 进程</button>
          
          <button onClick={() => onDelete(configIndex, queue.id)} style={{
            backgroundColor: '#ef4444', color: '#fff', border: 'none',
            borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer'
          }}>删除</button>
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {processes.map((process) => (
              <ProcessCard key={process.id} configIndex={configIndex} queueId={queue.id} process={process} mode={mode}
                isExpanded={expandedProcesses.has(`${configIndex}-${queue.id}-${process.id}`)}
                onToggleExpand={() => onToggleProcess(configIndex, queue.id, process.id)}
                onUpdate={onUpdateProcess} onDelete={onDeleteProcess}
                onUpdateCommand={onUpdateCommand} onAddCommand={onAddCommand} onDeleteCommand={onDeleteCommand}
                showLogBinding={showLogBinding} logBindings={logBindings} onBindLog={onBindLog} onUnbindLog={onUnbindLog} />
            ))}
            
            {processes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280', fontSize: '13px', border: '1px dashed #d1d5db', borderRadius: '4px' }}>
                暂无进程，点击"+ 进程"开始配置
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 配置卡片组件
const ConfigCard = ({
  config, configIndex, mode, isExpanded, onToggleExpand, onDelete, onAddQueue, onDeleteQueue,
  onAddProcess, onUpdateProcess, onDeleteProcess, onUpdateCommand, onAddCommand, onDeleteCommand,
  expandedQueues, onToggleQueue, expandedProcesses, onToggleProcess,
  onSave, onRun, onStop, schedulerStatus, saving,
  showLogBinding, logBindings, onBindLog, onUnbindLog
}) => {
  const queues = config.queues || [];
  const isRunning = schedulerStatus?.running;
  
  return (
    <div style={{ backgroundColor: '#fff', border: '2px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', backgroundColor: '#f0f9ff',
        borderBottom: isExpanded ? '2px solid #e5e7eb' : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onToggleExpand} style={{
            backgroundColor: 'transparent', border: 'none', fontSize: '18px',
            cursor: 'pointer', color: '#2c8af8', transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>▶</button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ backgroundColor: '#8b5cf6', color: '#fff', padding: '4px 12px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>
              {config.name}
            </span>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>{queues.length} 个队列</span>
            {isRunning && (
              <span style={{ backgroundColor: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                运行中 PID: {schedulerStatus.pid}
              </span>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onAddQueue(configIndex)} style={{
            backgroundColor: '#10b981', color: '#fff', border: 'none',
            borderRadius: '4px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer'
          }}>+ 队列</button>
          
          <button onClick={() => onSave(configIndex)} disabled={saving} style={{
            backgroundColor: saving ? '#9ca3af' : '#2c8af8', color: '#fff', border: 'none',
            borderRadius: '4px', padding: '6px 12px', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer'
          }}>{saving ? '保存中...' : '保存'}</button>
          
          {isRunning ? (
            <button onClick={() => onStop(configIndex)} style={{
              backgroundColor: '#ef4444', color: '#fff', border: 'none',
              borderRadius: '4px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer'
            }}>停止</button>
          ) : (
            <button onClick={() => onRun(configIndex)} style={{
              backgroundColor: '#ec4899', color: '#fff', border: 'none',
              borderRadius: '4px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer'
            }}>▶ 运行</button>
          )}
          
          {configIndex > 0 && (
            <button onClick={() => onDelete(configIndex)} style={{
              backgroundColor: '#ef4444', color: '#fff', border: 'none',
              borderRadius: '4px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer'
            }}>删除配置</button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {queues.map((queue) => (
              <QueueCard key={queue.id} configIndex={configIndex} queue={queue} mode={mode}
                isExpanded={expandedQueues.has(`${configIndex}-${queue.id}`)}
                onToggleExpand={() => onToggleQueue(configIndex, queue.id)}
                onDelete={onDeleteQueue} onAddProcess={onAddProcess} onUpdateProcess={onUpdateProcess}
                onDeleteProcess={onDeleteProcess} onUpdateCommand={onUpdateCommand} onAddCommand={onAddCommand}
                onDeleteCommand={onDeleteCommand} expandedProcesses={expandedProcesses} onToggleProcess={onToggleProcess}
                showLogBinding={showLogBinding} logBindings={logBindings} onBindLog={onBindLog} onUnbindLog={onUnbindLog} />
            ))}
            
            {queues.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280', fontSize: '14px', border: '1px dashed #d1d5db', borderRadius: '6px' }}>
                暂无队列配置，点击"+ 队列"开始配置
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CommandPage = () => {
  const { authenticatedFetch } = useAuth();
  const [mode, setMode] = useState('single');
  const [allConfigs, setAllConfigs] = useState({ configs: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [expandedConfigs, setExpandedConfigs] = useState(new Set([0]));
  const [expandedQueues, setExpandedQueues] = useState(new Set());
  const [expandedProcesses, setExpandedProcesses] = useState(new Set());
  const [schedulerStatus, setSchedulerStatus] = useState({});
  const [showLogBinding, setShowLogBinding] = useState(false);
  const [logBindings, setLogBindings] = useState({});

  // 加载所有配置
  const loadAllConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authenticatedFetch(`/api/commands/${mode}/all`);
      if (response.ok) {
        const data = await response.json();
        setAllConfigs(data);
        // 默认展开第一个配置
        if (data.configs?.length > 0) {
          setExpandedConfigs(new Set([0]));
        }
      } else {
        setError('加载配置失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, mode]);

  // 加载调度器状态
  const loadSchedulerStatus = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/scheduler/status');
      if (response.ok) {
        const data = await response.json();
        setSchedulerStatus(data[mode] || {});
      }
    } catch (err) {
      console.error('加载调度器状态失败:', err);
    }
  }, [authenticatedFetch, mode]);

  // 加载日志绑定
  const loadLogBindings = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/log/bindings');
      if (response.ok) {
        const data = await response.json();
        setLogBindings(data);
      }
    } catch (err) {
      console.error('加载日志绑定失败:', err);
    }
  }, [authenticatedFetch]);

  // 绑定日志
  const bindLog = useCallback(async (logMode, configIndex, queueId, processIndex, logPath) => {
    try {
      setError(null);
      const response = await authenticatedFetch(
        `/api/log/bind?mode=${logMode}&config_index=${configIndex}&queue_id=${queueId}&process_index=${processIndex}&log_path=${encodeURIComponent(logPath)}`,
        { method: 'POST' }
      );
      const result = await response.json();
      if (response.ok && result.success) {
        setSuccessMsg('日志绑定成功');
        setTimeout(() => setSuccessMsg(null), 3000);
        await loadLogBindings();
      } else {
        setError(result.message || result.detail || '绑定失败');
      }
    } catch (err) {
      setError('绑定日志失败: ' + err.message);
    }
  }, [authenticatedFetch, loadLogBindings]);

  // 解绑日志
  const unbindLog = useCallback(async (logMode, configIndex, queueId, processIndex) => {
    try {
      setError(null);
      const response = await authenticatedFetch(
        `/api/log/bind?mode=${logMode}&config_index=${configIndex}&queue_id=${queueId}&process_index=${processIndex}`,
        { method: 'DELETE' }
      );
      const result = await response.json();
      if (result.success) {
        setSuccessMsg('日志解绑成功');
        setTimeout(() => setSuccessMsg(null), 3000);
        await loadLogBindings();
      } else {
        setError(result.message || '解绑失败');
      }
    } catch (err) {
      setError('解绑日志失败: ' + err.message);
    }
  }, [authenticatedFetch, loadLogBindings]);

  // 保存单个配置
  const saveConfig = useCallback(async (configIndex) => {
    try {
      setSaving(prev => ({ ...prev, [configIndex]: true }));
      setError(null);
      
      const configData = allConfigs.configs[configIndex];
      const response = await authenticatedFetch(`/api/commands/${mode}?config_index=${configData.index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queues: configData.queues }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail || '保存失败');
      } else {
        setSuccessMsg(`${configData.name} 保存成功`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, [configIndex]: false }));
    }
  }, [authenticatedFetch, mode, allConfigs]);

  // 运行调度器
  const runScheduler = useCallback(async (configIndex) => {
    try {
      setError(null);
      const configData = allConfigs.configs[configIndex];
      const response = await authenticatedFetch(`/api/scheduler/${mode}/start?config_index=${configData.index}`, {
        method: 'POST',
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        setSuccessMsg(`运行成功，进程 PID ${result.pid} 已启动`);
        setTimeout(() => setSuccessMsg(null), 5000);
        await loadSchedulerStatus();
      } else {
        setError(result.message || result.detail || '启动失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    }
  }, [authenticatedFetch, mode, allConfigs, loadSchedulerStatus]);

  // 停止调度器
  const stopScheduler = useCallback(async (configIndex) => {
    try {
      setError(null);
      const configData = allConfigs.configs[configIndex];
      const response = await authenticatedFetch(`/api/scheduler/${mode}/stop?config_index=${configData.index}`, {
        method: 'POST',
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        setSuccessMsg('调度器已停止');
        setTimeout(() => setSuccessMsg(null), 3000);
        await loadSchedulerStatus();
      } else {
        setError(result.message || result.detail || '停止失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    }
  }, [authenticatedFetch, mode, allConfigs, loadSchedulerStatus]);

  // 创建新配置
  const createNewConfig = useCallback(async () => {
    try {
      setError(null);
      const response = await authenticatedFetch(`/api/commands/${mode}/new`, { method: 'POST' });
      
      if (response.ok) {
        await loadAllConfigs();
        setSuccessMsg('新配置创建成功');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || '创建失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    }
  }, [authenticatedFetch, mode, loadAllConfigs]);

  // 删除配置
  const deleteConfig = useCallback(async (configIndex) => {
    if (!window.confirm('确定要删除此配置吗？')) return;
    
    try {
      setError(null);
      const configData = allConfigs.configs[configIndex];
      const response = await authenticatedFetch(`/api/commands/${mode}/${configData.index}`, { method: 'DELETE' });
      
      if (response.ok) {
        await loadAllConfigs();
        setSuccessMsg('配置已删除');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || '删除失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    }
  }, [authenticatedFetch, mode, allConfigs, loadAllConfigs]);

  // 添加队列
  const addQueue = useCallback((configIndex) => {
    setAllConfigs(prev => ({
      ...prev,
      configs: prev.configs.map((config, idx) => {
        if (idx === configIndex) {
          const newQueue = {
            id: Math.max(0, ...config.queues.map(q => q.id)) + 1,
            processes: [{ id: 1, commands: [''], gpu_count: 1, memory: 20 }]
          };
          return { ...config, queues: [...config.queues, newQueue] };
        }
        return config;
      })
    }));
  }, []);

  // 删除队列
  const deleteQueue = useCallback((configIndex, queueId) => {
    setAllConfigs(prev => ({
      ...prev,
      configs: prev.configs.map((config, idx) => 
        idx === configIndex ? { ...config, queues: config.queues.filter(q => q.id !== queueId) } : config
      )
    }));
  }, []);

  // 添加进程
  const addProcess = useCallback((configIndex, queueId) => {
    setAllConfigs(prev => ({
      ...prev,
      configs: prev.configs.map((config, idx) => {
        if (idx === configIndex) {
          return {
            ...config,
            queues: config.queues.map(queue => {
              if (queue.id === queueId) {
                const newProcessId = Math.max(0, ...queue.processes.map(p => p.id)) + 1;
                return { ...queue, processes: [...queue.processes, { id: newProcessId, commands: [''], gpu_count: 1, memory: 20 }] };
              }
              return queue;
            })
          };
        }
        return config;
      })
    }));
  }, []);

  // 删除进程
  const deleteProcess = useCallback((configIndex, queueId, processId) => {
    setAllConfigs(prev => ({
      ...prev,
      configs: prev.configs.map((config, idx) => {
        if (idx === configIndex) {
          return {
            ...config,
            queues: config.queues.map(queue => 
              queue.id === queueId ? { ...queue, processes: queue.processes.filter(p => p.id !== processId) } : queue
            )
          };
        }
        return config;
      })
    }));
  }, []);

  // 更新进程
  const updateProcess = useCallback((configIndex, queueId, processId, field, value) => {
    setAllConfigs(prev => ({
      ...prev,
      configs: prev.configs.map((config, idx) => {
        if (idx === configIndex) {
          return {
            ...config,
            queues: config.queues.map(queue => 
              queue.id === queueId ? {
                ...queue,
                processes: queue.processes.map(process => 
                  process.id === processId ? { ...process, [field]: value } : process
                )
              } : queue
            )
          };
        }
        return config;
      })
    }));
  }, []);

  // 更新命令
  const updateCommand = useCallback((configIndex, queueId, processId, commandIndex, value) => {
    setAllConfigs(prev => ({
      ...prev,
      configs: prev.configs.map((config, idx) => {
        if (idx === configIndex) {
          return {
            ...config,
            queues: config.queues.map(queue => 
              queue.id === queueId ? {
                ...queue,
                processes: queue.processes.map(process => 
                  process.id === processId ? {
                    ...process,
                    commands: process.commands.map((cmd, i) => i === commandIndex ? value : cmd)
                  } : process
                )
              } : queue
            )
          };
        }
        return config;
      })
    }));
  }, []);

  // 添加命令
  const addCommand = useCallback((configIndex, queueId, processId) => {
    setAllConfigs(prev => ({
      ...prev,
      configs: prev.configs.map((config, idx) => {
        if (idx === configIndex) {
          return {
            ...config,
            queues: config.queues.map(queue => 
              queue.id === queueId ? {
                ...queue,
                processes: queue.processes.map(process => 
                  process.id === processId ? { ...process, commands: [...process.commands, ''] } : process
                )
              } : queue
            )
          };
        }
        return config;
      })
    }));
  }, []);

  // 删除命令
  const deleteCommand = useCallback((configIndex, queueId, processId, commandIndex) => {
    setAllConfigs(prev => ({
      ...prev,
      configs: prev.configs.map((config, idx) => {
        if (idx === configIndex) {
          return {
            ...config,
            queues: config.queues.map(queue => 
              queue.id === queueId ? {
                ...queue,
                processes: queue.processes.map(process => 
                  process.id === processId ? {
                    ...process,
                    commands: process.commands.filter((_, i) => i !== commandIndex)
                  } : process
                )
              } : queue
            )
          };
        }
        return config;
      })
    }));
  }, []);

  // 切换展开状态
  const toggleConfigExpanded = useCallback((configIndex) => {
    setExpandedConfigs(prev => {
      const newSet = new Set(prev);
      newSet.has(configIndex) ? newSet.delete(configIndex) : newSet.add(configIndex);
      return newSet;
    });
  }, []);

  const toggleQueueExpanded = useCallback((configIndex, queueId) => {
    const key = `${configIndex}-${queueId}`;
    setExpandedQueues(prev => {
      const newSet = new Set(prev);
      newSet.has(key) ? newSet.delete(key) : newSet.add(key);
      return newSet;
    });
  }, []);

  const toggleProcessExpanded = useCallback((configIndex, queueId, processId) => {
    const key = `${configIndex}-${queueId}-${processId}`;
    setExpandedProcesses(prev => {
      const newSet = new Set(prev);
      newSet.has(key) ? newSet.delete(key) : newSet.add(key);
      return newSet;
    });
  }, []);

  useEffect(() => { 
    loadAllConfigs(); 
    loadSchedulerStatus();
    loadLogBindings();
  }, [loadAllConfigs, loadSchedulerStatus, loadLogBindings]);

  // 定期刷新调度器状态
  useEffect(() => {
    const interval = setInterval(loadSchedulerStatus, 5000);
    return () => clearInterval(interval);
  }, [loadSchedulerStatus]);

  if (loading) {
    return (
      <div className="container" style={{ width: '97%', margin: '20px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#6b7280' }}>
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ width: '97%', margin: '20px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '24px', color: '#2c8af8', margin: 0, fontWeight: '700', textShadow: '0 2px 6px rgba(44,138,248,0.4)' }}>
          命令配置管理
        </h2>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showLogBinding} 
              onChange={(e) => setShowLogBinding(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            绑定日志
          </label>
          <button onClick={() => setMode('single')} style={{
            padding: '8px 16px', backgroundColor: mode === 'single' ? '#2c8af8' : '#f3f4f6',
            color: mode === 'single' ? '#fff' : '#374151', border: 'none', borderRadius: '6px',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.3s ease'
          }}>进程单卡运行</button>
          <button onClick={() => setMode('multi')} style={{
            padding: '8px 16px', backgroundColor: mode === 'multi' ? '#2c8af8' : '#f3f4f6',
            color: mode === 'multi' ? '#fff' : '#374151', border: 'none', borderRadius: '6px',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.3s ease'
          }}>进程多卡运行</button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', marginBottom: '12px', color: '#dc2626', fontSize: '14px' }}>
          ❌ {error}
        </div>
      )}

      {successMsg && (
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px', marginBottom: '12px', color: '#16a34a', fontSize: '14px' }}>
          ✅ {successMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={createNewConfig} style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>+ 新建配置</button>
        </div>
        
        <div style={{ fontSize: '13px', color: '#6b7280' }}>
          共 {allConfigs.configs?.length || 0} 个配置 | 模式: {mode === 'single' ? '单卡' : '多卡'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {(allConfigs.configs || []).map((config, configIndex) => (
          <ConfigCard 
            key={config.index} 
            config={config} 
            configIndex={configIndex} 
            mode={mode}
            isExpanded={expandedConfigs.has(configIndex)} 
            onToggleExpand={() => toggleConfigExpanded(configIndex)}
            onDelete={deleteConfig}
            onAddQueue={addQueue}
            onDeleteQueue={deleteQueue}
            onAddProcess={addProcess}
            onUpdateProcess={updateProcess}
            onDeleteProcess={deleteProcess}
            onUpdateCommand={updateCommand}
            onAddCommand={addCommand}
            onDeleteCommand={deleteCommand}
            expandedQueues={expandedQueues}
            onToggleQueue={toggleQueueExpanded}
            expandedProcesses={expandedProcesses}
            onToggleProcess={toggleProcessExpanded}
            onSave={saveConfig}
            onRun={runScheduler}
            onStop={stopScheduler}
            schedulerStatus={schedulerStatus[config.index]}
            saving={saving[configIndex]}
            showLogBinding={showLogBinding}
            logBindings={logBindings}
            onBindLog={bindLog}
            onUnbindLog={unbindLog}
          />
        ))}
        
        {(allConfigs.configs || []).length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', fontSize: '14px' }}>
            暂无配置，点击"+ 新建配置"开始
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandPage;
