import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// 进程状态卡片
const ProcessCard = ({ process, queueId, configIndex, mode, onViewLog, logBindings }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#f59e0b';
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'retrying': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'running': return '运行中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'retrying': return '重试中';
      default: return '等待中';
    }
  };

  const bindingKey = `${mode}_${configIndex}_${queueId}_${process.index}`;
  const hasLogBinding = logBindings && logBindings[bindingKey];

  return (
    <div style={{ 
      backgroundColor: '#fff', 
      border: '1px solid #e5e7eb', 
      borderRadius: '4px', 
      marginLeft: '40px', 
      marginBottom: '6px',
      padding: '10px 12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ 
            backgroundColor: '#e0e7ff', 
            color: '#3730a3', 
            padding: '2px 6px', 
            borderRadius: '3px', 
            fontSize: '11px',
            fontWeight: 'bold'
          }}>
            进程 {process.index + 1}
          </span>
          <span style={{ 
            backgroundColor: getStatusColor(process.status), 
            color: '#fff', 
            padding: '2px 6px', 
            borderRadius: '10px', 
            fontSize: '10px' 
          }}>
            {getStatusText(process.status)}
          </span>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            显存: {process.memory_gb}GB
          </span>
          {process.gpu_count > 1 && (
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              GPU数: {process.gpu_count}
            </span>
          )}
          {process.current_gpu !== null && (
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>
              GPU {process.current_gpu}
            </span>
          )}
          {process.gpus && process.gpus.length > 1 && (
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>
              GPUs: {process.gpus.join(',')}
            </span>
          )}
          {process.retry_count > 0 && (
            <span style={{ fontSize: '11px', color: '#f59e0b' }}>
              重试: {process.retry_count}次
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {hasLogBinding && (
            <span style={{ fontSize: '10px', color: '#10b981' }}>已绑定日志</span>
          )}
          <button 
            onClick={() => onViewLog(mode, configIndex, queueId, process.index)}
            style={{
              backgroundColor: hasLogBinding ? '#2c8af8' : '#6b7280',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            {hasLogBinding ? '查看日志' : '绑定日志'}
          </button>
        </div>
      </div>
      
      {/* 命令预览 */}
      <div style={{ marginTop: '6px', fontSize: '11px', color: '#6b7280' }}>
        <div style={{ 
          backgroundColor: '#f8fafc', 
          padding: '4px 8px', 
          borderRadius: '3px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {process.commands && process.commands[0] ? process.commands[0].slice(0, 80) + '...' : '无命令'}
        </div>
      </div>
      
      {/* 错误信息 */}
      {process.last_error && (
        <div style={{ 
          marginTop: '4px', 
          fontSize: '11px', 
          color: '#dc2626',
          backgroundColor: '#fef2f2',
          padding: '4px 8px',
          borderRadius: '3px'
        }}>
          错误: {process.last_error}
        </div>
      )}
    </div>
  );
};

// 队列状态卡片
const QueueCard = ({ queue, isExpanded, onToggle, configIndex, mode, onViewLog, logBindings }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#f59e0b';
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'running': return '运行中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      default: return '空闲';
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '6px', marginLeft: '20px', marginBottom: '8px' }}>
      <div 
        onClick={onToggle}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 12px', cursor: 'pointer', backgroundColor: '#f1f5f9'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#6b7280', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
          <span style={{ backgroundColor: '#2c8af8', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
            队列 {queue.id}
          </span>
          <span style={{ backgroundColor: getStatusColor(queue.status), color: '#fff', padding: '2px 6px', borderRadius: '10px', fontSize: '11px' }}>
            {getStatusText(queue.status)}
          </span>
          {queue.current_gpu !== null && (
            <span style={{ fontSize: '12px', color: '#6b7280' }}>GPU {queue.current_gpu}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280' }}>
          <span>待处理: {queue.pending_tasks}</span>
          <span>运行中: {queue.running_tasks}</span>
          <span style={{ color: '#10b981' }}>完成: {queue.completed_tasks}</span>
          <span style={{ color: '#ef4444' }}>失败: {queue.failed_tasks}</span>
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
            <strong>总任务数:</strong> {queue.total_tasks}
            {queue.current_task && (
              <span style={{ marginLeft: '12px', color: '#f59e0b' }}>
                {queue.current_task}
              </span>
            )}
          </div>
          
          {/* 进程列表 */}
          {queue.processes && queue.processes.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                进程列表 ({queue.processes.length})
              </div>
              {queue.processes.map((proc) => (
                <ProcessCard 
                  key={proc.index}
                  process={proc}
                  queueId={queue.id}
                  configIndex={configIndex}
                  mode={mode}
                  onViewLog={onViewLog}
                  logBindings={logBindings}
                />
              ))}
            </div>
          )}
          
          {queue.last_error && (
            <div style={{ padding: '8px', backgroundColor: '#fef2f2', borderRadius: '4px', color: '#dc2626', marginTop: '8px' }}>
              <strong>最后错误:</strong> {queue.last_error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 调度器状态卡片
const SchedulerCard = ({ scheduler, isExpanded, onToggle, onStop, expandedQueues, onToggleQueue, onViewLog, logBindings }) => {
  const getStateColor = (state) => {
    switch (state) {
      case 'running': return '#10b981';
      case 'completed': return '#2c8af8';
      case 'failed': return '#ef4444';
      case 'stopping': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStateText = (state) => {
    switch (state) {
      case 'starting': return '启动中';
      case 'running': return '运行中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'stopping': return '停止中';
      default: return '未知';
    }
  };

  const getModeText = (mode) => mode === 'single' ? '单卡模式' : '多卡模式';

  const queues = Object.values(scheduler.queues || {});

  return (
    <div style={{ 
      backgroundColor: '#fff', 
      border: '2px solid #e5e7eb', 
      borderRadius: '10px', 
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 16px', 
        backgroundColor: scheduler.state === 'running' ? '#f0fdf4' : scheduler.state === 'failed' ? '#fef2f2' : '#f0f9ff',
        borderBottom: isExpanded ? '2px solid #e5e7eb' : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onToggle} style={{
            backgroundColor: 'transparent', border: 'none', fontSize: '18px',
            cursor: 'pointer', color: '#2c8af8', transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>▶</button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              backgroundColor: getStateColor(scheduler.state), 
              color: '#fff', 
              padding: '4px 12px', 
              borderRadius: '6px', 
              fontSize: '14px', 
              fontWeight: 'bold' 
            }}>
              PID: {scheduler.pid}
            </span>
            <span style={{ 
              backgroundColor: scheduler.mode === 'single' ? '#8b5cf6' : '#ec4899', 
              color: '#fff', 
              padding: '3px 10px', 
              borderRadius: '4px', 
              fontSize: '12px' 
            }}>
              {getModeText(scheduler.mode)}
            </span>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              配置 {scheduler.config_index + 1}
            </span>
            <span style={{ 
              backgroundColor: getStateColor(scheduler.state), 
              color: '#fff', 
              padding: '2px 8px', 
              borderRadius: '10px', 
              fontSize: '11px' 
            }}>
              {getStateText(scheduler.state)}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
            <span>待处理: {scheduler.pending_tasks}</span>
            <span style={{ color: '#f59e0b' }}>运行中: {scheduler.running_tasks}</span>
            <span style={{ color: '#10b981' }}>完成: {scheduler.completed_tasks}/{scheduler.total_tasks}</span>
            {scheduler.failed_tasks > 0 && (
              <span style={{ color: '#ef4444' }}>失败: {scheduler.failed_tasks}</span>
            )}
          </div>
          
          {scheduler.state === 'running' && (
            <button onClick={onStop} style={{
              backgroundColor: '#ef4444', color: '#fff', border: 'none',
              borderRadius: '4px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer'
            }}>停止</button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '16px' }}>
          {/* 基本信息 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '12px', 
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            <div style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ color: '#6b7280', marginBottom: '4px' }}>启动时间</div>
              <div style={{ color: '#374151' }}>{scheduler.started_at?.replace('T', ' ').slice(0, 19)}</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ color: '#6b7280', marginBottom: '4px' }}>可用 GPU</div>
              <div style={{ color: '#374151' }}>{scheduler.gpus_used?.join(', ') || '无'}</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ color: '#6b7280', marginBottom: '4px' }}>正在使用</div>
              <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                {Object.keys(scheduler.gpu_assignments || {}).length > 0 
                  ? Object.keys(scheduler.gpu_assignments).join(', ')
                  : '无'}
              </div>
            </div>
          </div>
          
          {/* 队列列表 */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              队列状态 ({queues.length} 个队列)
            </div>
            {queues.map((queue) => (
              <QueueCard 
                key={queue.id} 
                queue={queue}
                isExpanded={expandedQueues.has(`${scheduler.pid}-${queue.id}`)}
                onToggle={() => onToggleQueue(scheduler.pid, queue.id)}
                configIndex={scheduler.config_index}
                mode={scheduler.mode}
                onViewLog={onViewLog}
                logBindings={logBindings}
              />
            ))}
          </div>
          
          {/* 错误信息 */}
          {scheduler.last_error && (
            <div style={{ 
              marginTop: '12px', 
              padding: '10px', 
              backgroundColor: '#fef2f2', 
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '13px'
            }}>
              <strong>错误:</strong> {scheduler.last_error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatusPage = () => {
  const { authenticatedFetch } = useAuth();
  const [schedulers, setSchedulers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [expandedSchedulers, setExpandedSchedulers] = useState(new Set());
  const [expandedQueues, setExpandedQueues] = useState(new Set());
  const [logBindings, setLogBindings] = useState({});
  const [logModal, setLogModal] = useState({ show: false, content: '', title: '' });
  const [bindLogModal, setBindLogModal] = useState({ show: false, mode: '', configIndex: 0, queueId: 0, processIndex: 0 });
  const [logPath, setLogPath] = useState('');

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

  // 加载调度器状态
  const loadSchedulers = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/scheduler/running');
      if (response.ok) {
        const data = await response.json();
        setSchedulers(data.schedulers || []);
        // 默认展开所有运行中的调度器
        const runningPids = new Set(
          (data.schedulers || [])
            .filter(s => s.state === 'running')
            .map(s => s.pid)
        );
        setExpandedSchedulers(prev => {
          const newSet = new Set(prev);
          runningPids.forEach(pid => newSet.add(pid));
          return newSet;
        });
        setError(null);
      } else {
        setError('加载调度器状态失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  // 停止调度器
  const stopScheduler = useCallback(async (pid) => {
    if (!window.confirm(`确定要停止调度器 (PID: ${pid}) 吗？`)) return;
    
    try {
      const response = await authenticatedFetch(`/api/scheduler/stop/${pid}`, { method: 'POST' });
      const result = await response.json();
      
      if (response.ok && result.success) {
        setSuccessMsg(result.message);
        setTimeout(() => setSuccessMsg(null), 3000);
        await loadSchedulers();
      } else {
        setError(result.detail || result.message || '停止失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    }
  }, [authenticatedFetch, loadSchedulers]);

  // 切换展开状态
  const toggleScheduler = useCallback((pid) => {
    setExpandedSchedulers(prev => {
      const newSet = new Set(prev);
      newSet.has(pid) ? newSet.delete(pid) : newSet.add(pid);
      return newSet;
    });
  }, []);

  const toggleQueue = useCallback((pid, queueId) => {
    const key = `${pid}-${queueId}`;
    setExpandedQueues(prev => {
      const newSet = new Set(prev);
      newSet.has(key) ? newSet.delete(key) : newSet.add(key);
      return newSet;
    });
  }, []);

  // 查看/绑定日志
  const handleViewLog = useCallback(async (mode, configIndex, queueId, processIndex) => {
    const bindingKey = `${mode}_${configIndex}_${queueId}_${processIndex}`;
    const hasBinding = logBindings[bindingKey];
    
    if (hasBinding) {
      // 已绑定，查看日志
      try {
        const response = await authenticatedFetch(
          `/api/log/content?mode=${mode}&config_index=${configIndex}&queue_id=${queueId}&process_index=${processIndex}&tail_lines=200`
        );
        const result = await response.json();
        if (result.success) {
          setLogModal({
            show: true,
            content: result.content,
            title: `日志 - 队列${queueId} 进程${processIndex + 1}`
          });
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError('读取日志失败: ' + err.message);
      }
    } else {
      // 未绑定，打开绑定对话框
      setBindLogModal({ show: true, mode, configIndex, queueId, processIndex });
      setLogPath('');
    }
  }, [authenticatedFetch, logBindings]);

  // 绑定日志
  const handleBindLog = useCallback(async () => {
    const { mode, configIndex, queueId, processIndex } = bindLogModal;
    try {
      const response = await authenticatedFetch(
        `/api/log/bind?mode=${mode}&config_index=${configIndex}&queue_id=${queueId}&process_index=${processIndex}&log_path=${encodeURIComponent(logPath)}`,
        { method: 'POST' }
      );
      const result = await response.json();
      if (result.success) {
        setSuccessMsg('日志绑定成功');
        setTimeout(() => setSuccessMsg(null), 3000);
        setBindLogModal({ show: false, mode: '', configIndex: 0, queueId: 0, processIndex: 0 });
        await loadLogBindings();
      } else {
        setError(result.message || result.detail);
      }
    } catch (err) {
      setError('绑定日志失败: ' + err.message);
    }
  }, [authenticatedFetch, bindLogModal, logPath, loadLogBindings]);

  // 初始加载和定时刷新
  useEffect(() => {
    loadSchedulers();
    loadLogBindings();
    const interval = setInterval(loadSchedulers, 3000);
    return () => clearInterval(interval);
  }, [loadSchedulers, loadLogBindings]);

  // 统计信息
  const runningCount = schedulers.filter(s => s.state === 'running').length;
  const completedCount = schedulers.filter(s => s.state === 'completed').length;
  const failedCount = schedulers.filter(s => s.state === 'failed').length;

  return (
    <div className="container" style={{ width: '97%', margin: '20px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '24px', color: '#2c8af8', margin: 0, fontWeight: '700', textShadow: '0 2px 6px rgba(44,138,248,0.4)' }}>
          调度器状态监控
        </h2>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
            <span style={{ color: '#10b981' }}>● 运行中: {runningCount}</span>
            <span style={{ color: '#2c8af8' }}>● 已完成: {completedCount}</span>
            <span style={{ color: '#ef4444' }}>● 失败: {failedCount}</span>
          </div>
          <button onClick={loadSchedulers} style={{
            backgroundColor: '#2c8af8', color: '#fff', border: 'none',
            borderRadius: '4px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer'
          }}>刷新</button>
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#6b7280' }}>
          加载中...
        </div>
      ) : schedulers.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px', 
          color: '#6b7280', 
          fontSize: '14px',
          backgroundColor: '#f9fafb',
          borderRadius: '10px',
          border: '1px dashed #d1d5db'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>暂无运行中的调度器</div>
          <div>请在"命令配置"页面启动调度器</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {schedulers.map((scheduler) => (
            <SchedulerCard
              key={scheduler.pid}
              scheduler={scheduler}
              isExpanded={expandedSchedulers.has(scheduler.pid)}
              onToggle={() => toggleScheduler(scheduler.pid)}
              onStop={() => stopScheduler(scheduler.pid)}
              expandedQueues={expandedQueues}
              onToggleQueue={toggleQueue}
              onViewLog={handleViewLog}
              logBindings={logBindings}
            />
          ))}
        </div>
      )}

      {/* 日志查看弹窗 */}
      {logModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '80%', maxHeight: '80%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>{logModal.title}</h3>
              <button onClick={() => setLogModal({ show: false, content: '', title: '' })} style={{
                backgroundColor: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280'
              }}>×</button>
            </div>
            <div style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
              <pre style={{ 
                margin: 0, fontSize: '12px', fontFamily: 'monospace', 
                backgroundColor: '#1e293b', color: '#e2e8f0', padding: '12px', borderRadius: '4px',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all'
              }}>
                {logModal.content || '日志为空'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 日志绑定弹窗 */}
      {bindLogModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '500px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>绑定日志文件</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
              队列 {bindLogModal.queueId} - 进程 {bindLogModal.processIndex + 1}
            </p>
            <input 
              type="text"
              placeholder="输入日志文件的绝对路径"
              value={logPath}
              onChange={(e) => setLogPath(e.target.value)}
              style={{
                width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px',
                fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setBindLogModal({ show: false, mode: '', configIndex: 0, queueId: 0, processIndex: 0 })} style={{
                backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer'
              }}>取消</button>
              <button onClick={handleBindLog} disabled={!logPath} style={{
                backgroundColor: logPath ? '#2c8af8' : '#9ca3af', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: logPath ? 'pointer' : 'not-allowed'
              }}>绑定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusPage;
