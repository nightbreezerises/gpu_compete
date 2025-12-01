import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// 进程卡片组件
const ProcessCard = ({
  queueId, process, processIndex, mode, isExpanded, onToggleExpand,
  onUpdate, onDelete, onUpdateCommand, onAddCommand, onDeleteCommand
}) => {
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
          </div>
        </div>
        
        <button onClick={() => onDelete(queueId, process.id)} style={{
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
                onChange={(e) => onUpdate(queueId, process.id, 'gpu_count', parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '3px', fontSize: '12px' }} />
            </div>
          )}
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '2px' }}>显存需求 (GB)</label>
            <input type="number" min="1" value={process.memory || 20}
              onChange={(e) => onUpdate(queueId, process.id, 'memory', parseInt(e.target.value) || 20)}
              style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '3px', fontSize: '12px' }} />
          </div>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>命令列表</label>
              <button onClick={() => onAddCommand(queueId, process.id)} style={{
                backgroundColor: '#10b981', color: '#fff', border: 'none',
                borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer'
              }}>+ 添加命令</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(process.commands || []).map((command, index) => (
                <div key={index} style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" value={command}
                    onChange={(e) => onUpdateCommand(queueId, process.id, index, e.target.value)}
                    placeholder="输入命令..."
                    style={{ flex: 1, padding: '6px', border: '1px solid #d1d5db', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' }} />
                  {(process.commands || []).length > 1 && (
                    <button onClick={() => onDeleteCommand(queueId, process.id, index)} style={{
                      backgroundColor: '#ef4444', color: '#fff', border: 'none',
                      borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer'
                    }}>删除</button>
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

// 队列卡片组件
const QueueCard = ({ 
  queue, mode, isExpanded, onToggleExpand, onDelete, onAddProcess,
  onUpdateProcess, onDeleteProcess, onUpdateCommand, onAddCommand, onDeleteCommand,
  expandedProcesses, onToggleProcess
}) => {
  const processes = queue.processes || [];
  
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 8px', backgroundColor: '#f9fafb',
        borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none', minHeight: '48px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={onToggleExpand} style={{
            backgroundColor: 'transparent', border: 'none', fontSize: '16px',
            cursor: 'pointer', color: '#6b7280', transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>▶</button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: '#2c8af8', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              队列 {queue.id}
            </span>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>{processes.length} 个进程</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onAddProcess(queue.id)} style={{
            backgroundColor: '#10b981', color: '#fff', border: 'none',
            borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer'
          }}>+ 添加进程</button>
          
          <button onClick={() => onDelete(queue.id)} style={{
            backgroundColor: '#ef4444', color: '#fff', border: 'none',
            borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer'
          }}>删除队列</button>
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {processes.map((process, index) => (
              <ProcessCard key={process.id} queueId={queue.id} process={process} processIndex={index} mode={mode}
                isExpanded={expandedProcesses.has(`${queue.id}-${process.id}`)}
                onToggleExpand={() => onToggleProcess(queue.id, process.id)}
                onUpdate={onUpdateProcess} onDelete={onDeleteProcess}
                onUpdateCommand={onUpdateCommand} onAddCommand={onAddCommand} onDeleteCommand={onDeleteCommand} />
            ))}
            
            {processes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '14px', border: '1px dashed #d1d5db', borderRadius: '4px' }}>
                暂无进程，点击"添加进程"开始配置
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
  const [config, setConfig] = useState({ queues: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expandedQueues, setExpandedQueues] = useState(new Set());
  const [expandedProcesses, setExpandedProcesses] = useState(new Set());

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

  const saveConfig = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await authenticatedFetch(`/api/commands/${mode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail || '保存失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [authenticatedFetch, mode, config]);

  const addQueue = useCallback(() => {
    const newQueue = {
      id: Math.max(0, ...config.queues.map(q => q.id)) + 1,
      processes: [{ id: 1, commands: [''], gpu_count: 1, memory: 20 }]
    };
    setConfig(prev => ({ ...prev, queues: [...prev.queues, newQueue] }));
    setExpandedQueues(prev => new Set(prev).add(newQueue.id));
    setExpandedProcesses(prev => new Set(prev).add(`${newQueue.id}-1`));
  }, [config.queues]);

  const deleteQueue = useCallback((queueId) => {
    setConfig(prev => ({ ...prev, queues: prev.queues.filter(q => q.id !== queueId) }));
    setExpandedQueues(prev => { const newSet = new Set(prev); newSet.delete(queueId); return newSet; });
  }, []);

  const addProcess = useCallback((queueId) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => {
        if (queue.id === queueId) {
          const newProcessId = Math.max(0, ...queue.processes.map(p => p.id)) + 1;
          return { ...queue, processes: [...queue.processes, { id: newProcessId, commands: [''], gpu_count: 1, memory: 20 }] };
        }
        return queue;
      })
    }));
  }, []);

  const deleteProcess = useCallback((queueId, processId) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => queue.id === queueId 
        ? { ...queue, processes: queue.processes.filter(p => p.id !== processId) } 
        : queue)
    }));
  }, []);

  const updateProcess = useCallback((queueId, processId, field, value) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => queue.id === queueId
        ? { ...queue, processes: queue.processes.map(process => process.id === processId ? { ...process, [field]: value } : process) }
        : queue)
    }));
  }, []);

  const updateCommand = useCallback((queueId, processId, commandIndex, value) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => queue.id === queueId
        ? { ...queue, processes: queue.processes.map(process => process.id === processId
            ? { ...process, commands: process.commands.map((cmd, idx) => idx === commandIndex ? value : cmd) }
            : process) }
        : queue)
    }));
  }, []);

  const addCommand = useCallback((queueId, processId) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => queue.id === queueId
        ? { ...queue, processes: queue.processes.map(process => process.id === processId
            ? { ...process, commands: [...process.commands, ''] }
            : process) }
        : queue)
    }));
  }, []);

  const deleteCommand = useCallback((queueId, processId, commandIndex) => {
    setConfig(prev => ({
      ...prev,
      queues: prev.queues.map(queue => queue.id === queueId
        ? { ...queue, processes: queue.processes.map(process => process.id === processId
            ? { ...process, commands: process.commands.filter((_, idx) => idx !== commandIndex) }
            : process) }
        : queue)
    }));
  }, []);

  const toggleQueueExpanded = useCallback((queueId) => {
    setExpandedQueues(prev => {
      const newSet = new Set(prev);
      newSet.has(queueId) ? newSet.delete(queueId) : newSet.add(queueId);
      return newSet;
    });
  }, []);

  const toggleProcessExpanded = useCallback((queueId, processId) => {
    const key = `${queueId}-${processId}`;
    setExpandedProcesses(prev => {
      const newSet = new Set(prev);
      newSet.has(key) ? newSet.delete(key) : newSet.add(key);
      return newSet;
    });
  }, []);

  const resetConfig = useCallback(async () => {
    if (!window.confirm('确定要重置配置吗？此操作将恢复到备份文件的原始配置，所有未保存的更改将丢失。')) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await authenticatedFetch(`/api/commands/${mode}/reset`, { method: 'POST' });
      
      if (response.ok) {
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

  useEffect(() => { loadConfig(); }, [loadConfig]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '24px', color: '#2c8af8', margin: 0, fontWeight: '700', textShadow: '0 2px 6px rgba(44,138,248,0.4)' }}>
          命令配置管理
        </h2>
        
        <div style={{ display: 'flex', gap: '8px' }}>
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
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={addQueue} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>+ 添加队列</button>
          <button onClick={saveConfig} disabled={saving} style={{ backgroundColor: saving ? '#9ca3af' : '#2c8af8', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 16px', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? '保存中...' : '保存'}</button>
          <button onClick={resetConfig} disabled={loading} style={{ backgroundColor: loading ? '#9ca3af' : '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 16px', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer' }}>重置</button>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>{config.queues.length} 个队列</div>
          <button onClick={() => console.log('运行命令功能待实现')} style={{ backgroundColor: '#ec4899', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>运行</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {config.queues.map((queue) => (
          <QueueCard key={queue.id} queue={queue} mode={mode}
            isExpanded={expandedQueues.has(queue.id)} onToggleExpand={() => toggleQueueExpanded(queue.id)}
            onDelete={deleteQueue} onAddProcess={addProcess} onUpdateProcess={updateProcess}
            onDeleteProcess={deleteProcess} onUpdateCommand={updateCommand} onAddCommand={addCommand}
            onDeleteCommand={deleteCommand} expandedProcesses={expandedProcesses} onToggleProcess={toggleProcessExpanded} />
        ))}
        
        {config.queues.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', fontSize: '14px' }}>
            暂无队列配置，点击"添加队列"开始配置
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandPage;
