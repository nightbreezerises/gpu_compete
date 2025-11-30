"""
Retry - 重试机制配置和函数
"""

import time
import logging
import random
from dataclasses import dataclass


@dataclass
class RetryConfig:
    """重试配置"""
    max_retry_before_backoff: int = 3   # 每 N 次重试后进入退避
    backoff_duration: int = 600         # 退避时间（秒），默认 10 分钟


def generate_uni_id() -> str:
    """生成唯一标识符"""
    return f"compete_{random.randint(100000, 999999)}"


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


def handle_task_retry(task, error_type: str, config: RetryConfig) -> str:
    """处理任务重试逻辑
    
    Args:
        task: Task 对象
        error_type: 错误类型
        config: 重试配置
    
    Returns:
        新生成的 uni_id
    """
    task.status = "pending"  # 重置为 pending 以便重试
    task.retry_count += 1
    task.error_type = error_type
    
    # 检查是否需要退避
    if task.retry_count % config.max_retry_before_backoff == 0:
        task.backoff_until = time.time() + config.backoff_duration
        logging.warning(
            f"🔄 Task {task.uni_id} failed (retry #{task.retry_count}, error={task.error_type}), "
            f"entering backoff for {config.backoff_duration // 60} minutes"
        )
    else:
        logging.warning(
            f"🔄 Task {task.uni_id} failed (retry #{task.retry_count}, error={task.error_type}), "
            f"will retry soon"
        )
    
    # 生成新的 uni_id 用于重试
    new_uni_id = generate_uni_id()
    task.uni_id = new_uni_id
    return new_uni_id