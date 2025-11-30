"""
GPU Monitor - 用于监控 GPU 状态
"""

import os
import subprocess
import logging
from typing import List
import psutil


class GPUMonitor:
    """GPU 状态监控"""
    
    @staticmethod
    def get_available_memory(gpu_id: int) -> float:
        """获取指定 GPU 的可用显存 (GB)"""
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-gpu=memory.free', '--format=csv,noheader,nounits', f'--id={gpu_id}'],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                return float(result.stdout.strip()) / 1024  # MB -> GB
        except Exception as e:
            logging.debug(f"Failed to get memory for GPU {gpu_id}: {e}")
        return 0.0
    
    @staticmethod
    def get_user_processes_on_gpu(gpu_id: int) -> List[int]:
        """获取当前用户在指定 GPU 上的 Python 进程 PID 列表"""
        pids = []
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-compute-apps=pid', '--format=csv,noheader,nounits', f'--id={gpu_id}'],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                current_user = os.getenv('USER', '')
                for line in result.stdout.strip().split('\n'):
                    try:
                        pid = int(line.strip())
                        proc = psutil.Process(pid)
                        if proc.username() == current_user and 'python' in proc.name().lower():
                            pids.append(pid)
                    except (ValueError, psutil.NoSuchProcess, psutil.AccessDenied):
                        continue
        except Exception as e:
            logging.debug(f"Failed to get processes for GPU {gpu_id}: {e}")
        return pids
    
    @staticmethod
    def detect_gpus() -> List[int]:
        """检测可用的 GPU 列表"""
        # 优先使用 CUDA_VISIBLE_DEVICES
        cuda_visible = os.environ.get('CUDA_VISIBLE_DEVICES', '')
        if cuda_visible:
            try:
                return [int(x.strip()) for x in cuda_visible.split(',') if x.strip()]
            except ValueError:
                pass
        # 否则使用 nvidia-smi 探测
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-gpu=index', '--format=csv,noheader'],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                return [int(x.strip()) for x in result.stdout.strip().split('\n') if x.strip()]
        except Exception:
            pass
        return []