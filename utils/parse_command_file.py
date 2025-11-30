"""
Command File Parser - 解析命令配置文件
"""

import os
import logging
from typing import List, Tuple


def parse_command_file(file_path: str) -> List[Tuple[List[str], int, int]]:
    """解析命令配置文件
    
    文件格式：
    - # 开头的行为注释
    - 空行分隔任务
    - 每个任务块：多行命令 + 最后一行 "队列ID,显存需求"
    
    Args:
        file_path: 命令配置文件路径
        
    Returns:
        List of (commands, queue_id, memory_gb)
        - commands: 命令列表
        - queue_id: 队列 ID
        - memory_gb: 显存需求 (GB)
    """
    tasks = []
    
    if not os.path.exists(file_path):
        logging.warning(f"Command file not found: {file_path}")
        return tasks
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 按空行分割任务块
    blocks = content.strip().split('\n\n')
    
    for block in blocks:
        lines = [line.strip() for line in block.strip().split('\n')]
        # 过滤注释和空行
        lines = [line for line in lines if line and not line.startswith('#')]
        
        if len(lines) < 2:
            continue
        
        # 最后一行是 "队列ID,显存需求"
        last_line = lines[-1]
        commands = lines[:-1]
        
        try:
            parts = last_line.split(',')
            queue_id = int(parts[0].strip())
            memory_gb = int(parts[1].strip()) if len(parts) > 1 else 20
            tasks.append((commands, queue_id, memory_gb))
        except (ValueError, IndexError) as e:
            logging.warning(f"Failed to parse task block: {e}")
            continue
    
    return tasks