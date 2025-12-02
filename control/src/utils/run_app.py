#!/usr/bin/env python3
"""
运行调度器模块
用于启动单卡或多卡GPU调度器
"""

import logging
import subprocess
import os
import signal
from pathlib import Path
from typing import Dict, Any, Optional, List
import json
import time

logger = logging.getLogger(__name__)


class AppRunner:
    """调度器运行管理器"""
    
    def __init__(self, project_root: Path = None):
        """
        初始化运行管理器
        
        Args:
            project_root: 项目根目录
        """
        if project_root is None:
            # src/utils -> src -> control -> compete_gpu_retry
            self.project_root = Path(__file__).parent.parent.parent.parent
        else:
            self.project_root = project_root
        
        # 调度器脚本路径
        self.app_dir = self.project_root / "app"
        self.single_gpu_script = self.app_dir / "main_gpu.py"
        self.multi_gpu_script = self.app_dir / "main_gpus.py"
        
        # 命令配置目录
        self.command_dir = self.project_root / "command"
        
        # 运行状态文件
        self.status_file = self.project_root / "control" / "logs" / "app_status.json"
        
        # 正在运行的进程
        self.running_processes: Dict[str, subprocess.Popen] = {}
    
    def _get_config_file_path(self, mode: str, config_index: int = 0) -> Path:
        """获取配置文件路径"""
        if mode == "single":
            base_name = "command_gpu"
        else:
            base_name = "command_gpus"
        
        if config_index == 0:
            return self.command_dir / f"{base_name}.txt"
        else:
            return self.command_dir / f"{base_name}_{config_index}.txt"
    
    def start_scheduler(self, mode: str, config_index: int = 0) -> Dict[str, Any]:
        """
        启动调度器
        
        Args:
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            config_index: 配置索引
            
        Returns:
            启动结果
        """
        try:
            # 确定脚本和配置文件
            if mode == "single":
                script = self.single_gpu_script
            else:
                script = self.multi_gpu_script
            
            config_file = self._get_config_file_path(mode, config_index)
            
            # 检查脚本是否存在
            if not script.exists():
                return {
                    "success": False,
                    "message": f"调度器脚本不存在: {script}"
                }
            
            # 检查配置文件是否存在
            if not config_file.exists():
                return {
                    "success": False,
                    "message": f"配置文件不存在: {config_file}"
                }
            
            # 生成进程标识
            process_key = f"{mode}_{config_index}"
            
            # 检查是否已经在运行
            if process_key in self.running_processes:
                proc = self.running_processes[process_key]
                if proc.poll() is None:  # 进程仍在运行
                    return {
                        "success": False,
                        "message": f"配置 {config_index + 1} 的调度器已在运行 (PID: {proc.pid})"
                    }
            
            # 构建命令
            cmd = [
                "python", str(script),
                "--command-file", str(config_file),
                "--config-index", str(config_index)
            ]
            
            # 启动进程
            logger.info(f"启动调度器: {' '.join(cmd)}")
            
            # 使用 nohup 方式启动，确保进程独立运行
            log_dir = self.project_root / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            
            log_file = log_dir / f"scheduler_{mode}_{config_index}.log"
            
            with open(log_file, "a") as log_f:
                proc = subprocess.Popen(
                    cmd,
                    stdout=log_f,
                    stderr=subprocess.STDOUT,
                    cwd=str(self.project_root),
                    start_new_session=True,  # 创建新会话，使进程独立
                    env=os.environ.copy()  # 显式传递环境变量，确保 HOME 等变量被继承
                )
            
            self.running_processes[process_key] = proc
            
            # 保存状态
            self._save_status()
            
            logger.info(f"调度器已启动，PID: {proc.pid}")
            
            return {
                "success": True,
                "message": f"调度器已启动",
                "pid": proc.pid,
                "log_file": str(log_file),
                "config_file": str(config_file)
            }
            
        except Exception as e:
            logger.error(f"启动调度器失败: {e}")
            return {
                "success": False,
                "message": f"启动失败: {str(e)}"
            }
    
    def stop_scheduler(self, mode: str, config_index: int = 0) -> Dict[str, Any]:
        """
        停止调度器
        
        Args:
            mode: 模式
            config_index: 配置索引
            
        Returns:
            停止结果
        """
        try:
            process_key = f"{mode}_{config_index}"
            
            if process_key not in self.running_processes:
                return {
                    "success": False,
                    "message": "调度器未在运行"
                }
            
            proc = self.running_processes[process_key]
            
            if proc.poll() is not None:
                # 进程已经结束
                del self.running_processes[process_key]
                self._save_status()
                return {
                    "success": True,
                    "message": "调度器已停止（进程已结束）"
                }
            
            # 发送终止信号
            logger.info(f"停止调度器 PID: {proc.pid}")
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            
            # 等待进程结束
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                # 强制终止
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                proc.wait()
            
            del self.running_processes[process_key]
            self._save_status()
            
            return {
                "success": True,
                "message": "调度器已停止"
            }
            
        except Exception as e:
            logger.error(f"停止调度器失败: {e}")
            return {
                "success": False,
                "message": f"停止失败: {str(e)}"
            }
    
    def get_scheduler_status(self, mode: str, config_index: int = 0) -> Dict[str, Any]:
        """
        获取调度器状态
        
        Args:
            mode: 模式
            config_index: 配置索引
            
        Returns:
            状态信息
        """
        process_key = f"{mode}_{config_index}"
        
        if process_key not in self.running_processes:
            return {
                "running": False,
                "pid": None
            }
        
        proc = self.running_processes[process_key]
        
        if proc.poll() is not None:
            # 进程已结束
            del self.running_processes[process_key]
            return {
                "running": False,
                "pid": None,
                "exit_code": proc.returncode
            }
        
        return {
            "running": True,
            "pid": proc.pid
        }
    
    def get_all_status(self) -> Dict[str, Any]:
        """获取所有调度器状态"""
        result = {
            "single": {},
            "multi": {}
        }
        
        for process_key, proc in list(self.running_processes.items()):
            mode, config_index = process_key.rsplit("_", 1)
            config_index = int(config_index)
            
            if proc.poll() is None:
                result[mode][config_index] = {
                    "running": True,
                    "pid": proc.pid
                }
            else:
                result[mode][config_index] = {
                    "running": False,
                    "exit_code": proc.returncode
                }
                del self.running_processes[process_key]
        
        return result
    
    def _save_status(self):
        """保存运行状态到文件"""
        try:
            status = {}
            for process_key, proc in self.running_processes.items():
                if proc.poll() is None:
                    status[process_key] = {
                        "pid": proc.pid,
                        "running": True
                    }
            
            self.status_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.status_file, "w") as f:
                json.dump(status, f, indent=2)
        except Exception as e:
            logger.error(f"保存状态失败: {e}")


# 全局实例
_app_runner: Optional[AppRunner] = None


def get_app_runner(project_root: Path = None) -> AppRunner:
    """获取运行管理器实例"""
    global _app_runner
    if _app_runner is None:
        _app_runner = AppRunner(project_root)
    return _app_runner


# 导出
__all__ = [
    'AppRunner',
    'get_app_runner'
]