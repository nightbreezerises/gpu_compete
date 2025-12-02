"""
Retry - 重试机制配置和函数

提供任务重试的配置和辅助函数。
重试逻辑已集成到 main_gpu.py 和 main_gpus.py 的 _handle_task_failure 方法中。
"""

import time
import logging
from dataclasses import dataclass


@dataclass
class RetryConfig:
    """重试配置
    
    Attributes:
        max_retry_before_backoff: 每 N 次重试后进入退避期
        backoff_duration: 退避时间（秒），默认 10 分钟
    """
    max_retry_before_backoff: int = 3   # 每 N 次重试后进入退避
    backoff_duration: int = 600         # 退避时间（秒），默认 10 分钟


def is_task_ready(task, current_time: float = None) -> bool:
    """检查任务是否可以被调度（考虑退避）
    
    Args:
        task: Task 对象，需要有 status 和 backoff_until 属性
        current_time: 当前时间戳，默认使用 time.time()
    
    Returns:
        True 如果任务可以被调度
    """
    if current_time is None:
        current_time = time.time()
    
    if task.status != "pending":
        return False
    if task.backoff_until > 0 and current_time < task.backoff_until:
        return False  # 还在退避期
    return True