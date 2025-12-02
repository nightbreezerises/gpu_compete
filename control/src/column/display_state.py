#!/usr/bin/env python3
"""
调度器状态管理模块

功能：
- 读取调度器状态文件
- 管理日志绑定（独立存储，不写入命令配置文件）
- 提供状态查询和日志查看 API
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class SchedulerStateManager:
    """调度器状态管理器"""
    
    def __init__(self, project_root: Path = None):
        """初始化状态管理器
        
        Args:
            project_root: 项目根目录
        """
        if project_root is None:
            # column -> src -> control -> compete_gpu_retry
            self.project_root = Path(__file__).parent.parent.parent.parent
        else:
            self.project_root = Path(project_root)
        
        # 状态文件目录
        self.status_dir = self.project_root / "logs" / "status"
        
        # 日志绑定配置文件（独立存储）
        self.log_bindings_file = self.project_root / "control" / "logs" / "log_bindings.json"
        self.log_bindings_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 加载日志绑定
        self._log_bindings = self._load_log_bindings()
    
    def _load_log_bindings(self) -> Dict[str, Dict[str, str]]:
        """加载日志绑定配置"""
        if self.log_bindings_file.exists():
            try:
                return json.loads(self.log_bindings_file.read_text(encoding="utf-8"))
            except Exception as e:
                logger.error(f"加载日志绑定失败: {e}")
        return {}
    
    def _save_log_bindings(self):
        """保存日志绑定配置"""
        try:
            self.log_bindings_file.write_text(
                json.dumps(self._log_bindings, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
        except Exception as e:
            logger.error(f"保存日志绑定失败: {e}")
    
    def _is_process_running(self, pid: int) -> bool:
        """检查进程是否仍在运行"""
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False
    
    def list_running_schedulers(self) -> List[int]:
        """列出所有正在运行的调度器 PID"""
        if not self.status_dir.exists():
            return []
        
        pids = []
        for status_file in self.status_dir.glob("*.json"):
            try:
                pid = int(status_file.stem)
                if self._is_process_running(pid):
                    pids.append(pid)
                else:
                    # 清理已停止进程的状态文件
                    try:
                        status_file.unlink()
                    except:
                        pass
            except ValueError:
                pass
        
        return sorted(pids)
    
    def get_scheduler_status(self, pid: int) -> Optional[Dict]:
        """获取指定调度器的状态"""
        status_file = self.status_dir / f"{pid}.json"
        if not status_file.exists():
            return None
        
        try:
            data = json.loads(status_file.read_text(encoding="utf-8"))
            return data
        except Exception as e:
            logger.error(f"读取调度器状态失败: {e}")
            return None
    
    def get_all_scheduler_status(self) -> List[Dict]:
        """获取所有运行中调度器的状态"""
        schedulers = []
        for pid in self.list_running_schedulers():
            status = self.get_scheduler_status(pid)
            if status:
                schedulers.append(status)
        return schedulers
    
    def stop_scheduler(self, pid: int) -> Dict[str, Any]:
        """停止调度器"""
        import signal
        
        # 检查进程是否存在
        if not self._is_process_running(pid):
            return {"success": False, "message": f"进程 {pid} 不存在"}
        
        try:
            # 发送 SIGTERM 信号
            os.kill(pid, signal.SIGTERM)
            
            # 等待进程结束
            import time
            for _ in range(10):
                if not self._is_process_running(pid):
                    break
                time.sleep(0.5)
            
            # 检查是否成功停止
            if self._is_process_running(pid):
                # 进程仍在运行，发送 SIGKILL
                os.kill(pid, signal.SIGKILL)
            
            return {"success": True, "message": f"调度器 (PID: {pid}) 已停止"}
        except Exception as e:
            return {"success": False, "message": f"停止失败: {str(e)}"}
    
    # ==================== 日志绑定管理 ====================
    
    def bind_log(self, mode: str, config_index: int, queue_id: int, 
                 process_index: int, log_path: str) -> Dict[str, Any]:
        """绑定日志文件
        
        Args:
            mode: 模式 (single/multi)
            config_index: 配置索引
            queue_id: 队列 ID
            process_index: 进程索引（队列内）
            log_path: 日志文件路径
        
        Returns:
            操作结果
        """
        key = f"{mode}_{config_index}_{queue_id}_{process_index}"
        
        # 验证日志文件存在
        log_file = Path(log_path)
        if not log_file.exists():
            return {"success": False, "message": f"日志文件不存在: {log_path}"}
        
        self._log_bindings[key] = {
            "mode": mode,
            "config_index": config_index,
            "queue_id": queue_id,
            "process_index": process_index,
            "log_path": str(log_file.absolute()),
            "bound_at": datetime.now().isoformat()
        }
        
        self._save_log_bindings()
        return {"success": True, "message": "日志绑定成功"}
    
    def unbind_log(self, mode: str, config_index: int, queue_id: int, 
                   process_index: int) -> Dict[str, Any]:
        """解除日志绑定"""
        key = f"{mode}_{config_index}_{queue_id}_{process_index}"
        
        if key in self._log_bindings:
            del self._log_bindings[key]
            self._save_log_bindings()
            return {"success": True, "message": "日志绑定已解除"}
        
        return {"success": False, "message": "未找到绑定"}
    
    def get_log_binding(self, mode: str, config_index: int, queue_id: int, 
                        process_index: int) -> Optional[Dict]:
        """获取日志绑定信息"""
        key = f"{mode}_{config_index}_{queue_id}_{process_index}"
        return self._log_bindings.get(key)
    
    def get_all_log_bindings(self) -> Dict[str, Dict]:
        """获取所有日志绑定"""
        return self._log_bindings.copy()
    
    def read_log_content(self, mode: str, config_index: int, queue_id: int, 
                         process_index: int, tail_lines: int = 100) -> Dict[str, Any]:
        """读取日志内容
        
        Args:
            tail_lines: 读取最后多少行
        
        Returns:
            日志内容
        """
        binding = self.get_log_binding(mode, config_index, queue_id, process_index)
        if not binding:
            return {"success": False, "message": "未绑定日志文件", "content": ""}
        
        log_path = Path(binding["log_path"])
        if not log_path.exists():
            return {"success": False, "message": f"日志文件不存在: {log_path}", "content": ""}
        
        try:
            # 读取最后 N 行
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
                content = "".join(lines[-tail_lines:])
            
            return {
                "success": True,
                "message": "读取成功",
                "content": content,
                "log_path": str(log_path),
                "total_lines": len(lines)
            }
        except Exception as e:
            return {"success": False, "message": f"读取失败: {str(e)}", "content": ""}
    
    def read_log_by_path(self, log_path: str, tail_lines: int = 100) -> Dict[str, Any]:
        """直接通过路径读取日志"""
        log_file = Path(log_path)
        if not log_file.exists():
            return {"success": False, "message": f"日志文件不存在: {log_path}", "content": ""}
        
        try:
            with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
                content = "".join(lines[-tail_lines:])
            
            return {
                "success": True,
                "message": "读取成功",
                "content": content,
                "log_path": str(log_file),
                "total_lines": len(lines)
            }
        except Exception as e:
            return {"success": False, "message": f"读取失败: {str(e)}", "content": ""}


# 全局实例
_state_manager: Optional[SchedulerStateManager] = None


def get_state_manager() -> SchedulerStateManager:
    """获取状态管理器实例"""
    global _state_manager
    if _state_manager is None:
        _state_manager = SchedulerStateManager()
    return _state_manager
