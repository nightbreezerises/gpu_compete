#!/usr/bin/env python3
"""
状态写入模块 - 用于调度器与前端共享状态信息

功能：
- 将调度器运行状态写入 JSON 文件
- 前端可以读取 JSON 文件获取实时状态
- 支持多个调度器实例同时运行（每个使用独立的 JSON 文件）

文件位置：/logs/status/{pid}.json
"""

import os
import json
import atexit
import signal
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict


@dataclass
class QueueStatus:
    """队列状态"""
    id: int
    status: str = "idle"  # idle | running | completed | failed
    total_tasks: int = 0
    pending_tasks: int = 0
    running_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    current_task: Optional[str] = None  # 当前正在执行的任务描述
    current_gpu: Optional[int] = None   # 当前使用的 GPU
    last_error: Optional[str] = None    # 最后一个错误信息


@dataclass
class SchedulerStatus:
    """调度器状态"""
    pid: int
    mode: str  # "single" | "multi"
    config_index: int
    config_file: str
    state: str = "starting"  # starting | running | completed | failed | stopping
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    
    # 任务统计
    total_tasks: int = 0
    pending_tasks: int = 0
    running_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    
    # GPU 信息
    gpus_used: List[int] = field(default_factory=list)
    gpus_available: List[int] = field(default_factory=list)
    gpu_assignments: Dict[int, int] = field(default_factory=dict)  # gpu_id -> queue_id
    
    # 队列信息
    queues: Dict[int, Dict[str, Any]] = field(default_factory=dict)
    
    # 最近日志
    last_log_lines: List[str] = field(default_factory=list)
    last_error: Optional[str] = None
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> "SchedulerStatus":
        """从字典创建"""
        return cls(**data)


class StatusWriter:
    """状态写入器
    
    用于将调度器状态写入 JSON 文件，供前端读取
    """
    
    def __init__(self, 
                 status_dir: Path,
                 mode: str,
                 config_index: int,
                 config_file: str,
                 pid: Optional[int] = None):
        """初始化状态写入器
        
        Args:
            status_dir: 状态文件目录
            mode: 调度模式 ("single" | "multi")
            config_index: 配置索引
            config_file: 配置文件路径
            pid: 进程 ID（默认使用当前进程 ID）
        """
        self.status_dir = Path(status_dir)
        self.status_dir.mkdir(parents=True, exist_ok=True)
        
        self.pid = pid or os.getpid()
        self.status_file = self.status_dir / f"{self.pid}.json"
        
        # 初始化状态
        self.status = SchedulerStatus(
            pid=self.pid,
            mode=mode,
            config_index=config_index,
            config_file=config_file,
            state="starting",
            started_at=datetime.now().isoformat()
        )
        
        # 注册退出时清理
        atexit.register(self._cleanup)
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        # 写入初始状态
        self._save()
    
    def _signal_handler(self, signum, frame):
        """信号处理器"""
        self._cleanup()
        # 重新抛出信号让程序正常退出
        signal.signal(signum, signal.SIG_DFL)
        os.kill(os.getpid(), signum)
    
    def _cleanup(self):
        """清理状态文件"""
        try:
            if self.status_file.exists():
                self.status_file.unlink()
        except Exception:
            pass
    
    def _save(self):
        """保存状态到文件（原子写入）"""
        try:
            tmp_file = self.status_file.with_suffix(".tmp")
            tmp_file.write_text(
                json.dumps(self.status.to_dict(), ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
            tmp_file.replace(self.status_file)
        except Exception as e:
            # 写入失败不应该影响调度器运行
            pass
    
    def set_state(self, state: str):
        """设置调度器状态"""
        self.status.state = state
        if state in ("completed", "failed", "stopping"):
            self.status.finished_at = datetime.now().isoformat()
        self._save()
    
    def set_gpus(self, gpus_used: List[int], gpus_available: List[int]):
        """设置 GPU 信息"""
        self.status.gpus_used = gpus_used
        self.status.gpus_available = gpus_available
        self._save()
    
    def update_gpu_assignment(self, gpu_id: int, queue_id: Optional[int]):
        """更新 GPU 分配"""
        if queue_id is not None:
            self.status.gpu_assignments[gpu_id] = queue_id
        elif gpu_id in self.status.gpu_assignments:
            del self.status.gpu_assignments[gpu_id]
        self._save()
    
    def init_queues(self, queues: Dict[int, int]):
        """初始化队列信息
        
        Args:
            queues: {queue_id: task_count}
        """
        self.status.total_tasks = sum(queues.values())
        self.status.pending_tasks = self.status.total_tasks
        
        for queue_id, task_count in queues.items():
            self.status.queues[queue_id] = {
                "id": queue_id,
                "status": "idle",
                "total_tasks": task_count,
                "pending_tasks": task_count,
                "running_tasks": 0,
                "completed_tasks": 0,
                "failed_tasks": 0,
                "current_task": None,
                "current_gpu": None,
                "last_error": None,
                "processes": []  # 进程列表
            }
        self._save()
    
    def init_queue_processes(self, queue_id: int, processes: list):
        """初始化队列的进程列表
        
        Args:
            queue_id: 队列 ID
            processes: 进程信息列表 [{commands, memory_gb, gpu_count(optional)}]
        """
        if queue_id not in self.status.queues:
            return
        
        proc_list = []
        for idx, proc in enumerate(processes):
            proc_list.append({
                "index": idx,
                "commands": proc.get("commands", []),
                "memory_gb": proc.get("memory_gb", 0),
                "gpu_count": proc.get("gpu_count", 1),
                "status": "pending",  # pending | running | completed | failed | retrying
                "current_gpu": None,
                "gpus": [],  # 多GPU模式下使用的GPU列表
                "retry_count": 0,
                "last_error": None,
                "started_at": None,
                "finished_at": None
            })
        
        self.status.queues[queue_id]["processes"] = proc_list
        self._save()
    
    def update_process_status(self, queue_id: int, process_idx: int, 
                              status: str = None,
                              current_gpu: int = None,
                              gpus: list = None,
                              retry_count: int = None,
                              last_error: str = None,
                              started_at: str = None,
                              finished_at: str = None):
        """更新进程状态"""
        if queue_id not in self.status.queues:
            return
        
        processes = self.status.queues[queue_id].get("processes", [])
        if process_idx >= len(processes):
            return
        
        proc = processes[process_idx]
        if status is not None:
            proc["status"] = status
        if current_gpu is not None:
            proc["current_gpu"] = current_gpu
        if gpus is not None:
            proc["gpus"] = gpus
        if retry_count is not None:
            proc["retry_count"] = retry_count
        if last_error is not None:
            proc["last_error"] = last_error[:200] if last_error else None
        if started_at is not None:
            proc["started_at"] = started_at
        if finished_at is not None:
            proc["finished_at"] = finished_at
        
        self._save()
    
    def update_queue_status(self, 
                           queue_id: int, 
                           status: str,
                           pending: int = None,
                           running: int = None,
                           completed: int = None,
                           failed: int = None,
                           current_task: str = None,
                           current_gpu: int = None,
                           last_error: str = None):
        """更新队列状态"""
        if queue_id not in self.status.queues:
            return
        
        q = self.status.queues[queue_id]
        q["status"] = status
        
        if pending is not None:
            q["pending_tasks"] = pending
        if running is not None:
            q["running_tasks"] = running
        if completed is not None:
            q["completed_tasks"] = completed
        if failed is not None:
            q["failed_tasks"] = failed
        if current_task is not None:
            q["current_task"] = current_task
        if current_gpu is not None:
            q["current_gpu"] = current_gpu
        if last_error is not None:
            q["last_error"] = last_error
        
        # 重新计算总体统计
        self._recalculate_totals()
        self._save()
    
    def on_task_start(self, queue_id: int, task_idx: int, total_tasks: int, gpu_id: int, command: str):
        """任务开始"""
        self.update_queue_status(
            queue_id=queue_id,
            status="running",
            pending=total_tasks - task_idx - 1,
            running=1,
            current_task=f"任务 {task_idx + 1}/{total_tasks}: {command[:50]}...",
            current_gpu=gpu_id
        )
        self.update_gpu_assignment(gpu_id, queue_id)
    
    def on_task_success(self, queue_id: int, task_idx: int, total_tasks: int, gpu_id: int):
        """任务成功"""
        q = self.status.queues.get(queue_id, {})
        completed = q.get("completed_tasks", 0) + 1
        
        self.update_queue_status(
            queue_id=queue_id,
            status="running" if task_idx + 1 < total_tasks else "completed",
            running=0,
            completed=completed,
            current_task=None,
            current_gpu=None
        )
        self.update_gpu_assignment(gpu_id, None)
    
    def on_task_fail(self, queue_id: int, task_idx: int, total_tasks: int, gpu_id: int, error: str, will_retry: bool):
        """任务失败"""
        q = self.status.queues.get(queue_id, {})
        
        if will_retry:
            # 会重试，不增加 failed 计数
            self.update_queue_status(
                queue_id=queue_id,
                status="running",
                running=0,
                current_task=f"任务 {task_idx + 1}/{total_tasks} 失败，准备重试",
                current_gpu=None,
                last_error=error[:100]
            )
        else:
            # 不会重试，增加 failed 计数
            failed = q.get("failed_tasks", 0) + 1
            self.update_queue_status(
                queue_id=queue_id,
                status="failed",
                running=0,
                failed=failed,
                current_task=None,
                current_gpu=None,
                last_error=error[:100]
            )
        
        self.update_gpu_assignment(gpu_id, None)
    
    def on_queue_complete(self, queue_id: int):
        """队列完成"""
        self.update_queue_status(
            queue_id=queue_id,
            status="completed",
            running=0,
            current_task=None,
            current_gpu=None
        )
    
    def on_queue_fail(self, queue_id: int, error: str):
        """队列失败"""
        self.update_queue_status(
            queue_id=queue_id,
            status="failed",
            running=0,
            current_task=None,
            current_gpu=None,
            last_error=error[:100]
        )
    
    def append_log(self, line: str):
        """添加日志行（保留最近 20 行）"""
        self.status.last_log_lines = (self.status.last_log_lines + [line])[-20:]
        self._save()
    
    def set_error(self, error: str):
        """设置错误信息"""
        self.status.last_error = error[:200]
        self._save()
    
    def _recalculate_totals(self):
        """重新计算总体统计"""
        pending = 0
        running = 0
        completed = 0
        failed = 0
        
        for q in self.status.queues.values():
            pending += q.get("pending_tasks", 0)
            running += q.get("running_tasks", 0)
            completed += q.get("completed_tasks", 0)
            failed += q.get("failed_tasks", 0)
        
        self.status.pending_tasks = pending
        self.status.running_tasks = running
        self.status.completed_tasks = completed
        self.status.failed_tasks = failed


class StatusReader:
    """状态读取器
    
    用于前端读取所有调度器的状态
    """
    
    def __init__(self, status_dir: Path):
        """初始化状态读取器
        
        Args:
            status_dir: 状态文件目录
        """
        self.status_dir = Path(status_dir)
    
    def list_schedulers(self) -> List[int]:
        """列出所有正在运行的调度器 PID"""
        if not self.status_dir.exists():
            return []
        
        pids = []
        for f in self.status_dir.glob("*.json"):
            try:
                pid = int(f.stem)
                # 检查进程是否仍在运行
                if self._is_process_running(pid):
                    pids.append(pid)
                else:
                    # 清理已停止进程的状态文件
                    try:
                        f.unlink()
                    except:
                        pass
            except ValueError:
                pass
        
        return sorted(pids)
    
    def get_status(self, pid: int) -> Optional[Dict]:
        """获取指定调度器的状态"""
        status_file = self.status_dir / f"{pid}.json"
        if not status_file.exists():
            return None
        
        try:
            data = json.loads(status_file.read_text(encoding="utf-8"))
            return data
        except Exception:
            return None
    
    def get_all_status(self) -> Dict[int, Dict]:
        """获取所有调度器的状态"""
        result = {}
        for pid in self.list_schedulers():
            status = self.get_status(pid)
            if status:
                result[pid] = status
        return result
    
    def _is_process_running(self, pid: int) -> bool:
        """检查进程是否仍在运行"""
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


# 全局状态写入器实例（由调度器初始化）
_status_writer: Optional[StatusWriter] = None


def init_status_writer(status_dir: Path, mode: str, config_index: int, config_file: str) -> StatusWriter:
    """初始化全局状态写入器"""
    global _status_writer
    _status_writer = StatusWriter(status_dir, mode, config_index, config_file)
    return _status_writer


def get_status_writer() -> Optional[StatusWriter]:
    """获取全局状态写入器"""
    return _status_writer
