"""
Command File Parser - 解析多GPU命令配置文件
"""

import os
import logging
from typing import List, Tuple


def parse_command_file(file_path: str) -> List[Tuple[List[str], int, int, int]]:
    """解析多GPU命令配置文件
    
    文件格式：
    - # 开头的行为注释
    - 空行分隔任务
    - 每个任务块：队列ID行 + 多行命令 + GPU数量需求行 + 显存需求行
    
    Args:
        file_path: 命令配置文件路径
        
    Returns:
        List of (commands, queue_id, gpu_count, memory_gb)
        - commands: 命令列表
        - queue_id: 队列 ID
        - gpu_count: GPU 数量需求
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
        
        if len(lines) < 4:  # 至少需要：队列ID行 + 命令行 + GPU数量行 + 显存需求行
            continue
        
        # 第一行是队列ID，倒数第二行是GPU数量，最后一行是显存需求，中间是命令
        queue_id_line = lines[0]
        gpu_count_line = lines[-2]
        memory_line = lines[-1]
        # 命令直接使用，不需要引号
        commands = [cmd.strip() for cmd in lines[1:-2]]
        
        try:
            # 解析队列ID
            queue_id = _parse_number(queue_id_line)
            
            # 解析GPU数量需求
            gpu_count = _parse_number(gpu_count_line)
            
            # 解析显存需求
            memory_gb = _parse_number(memory_line)
            
            tasks.append((commands, queue_id, gpu_count, memory_gb))
        except (ValueError, IndexError) as e:
            logging.warning(f"Failed to parse task block: {e}")
            logging.warning(f"  Queue line: {queue_id_line}")
            logging.warning(f"  GPU count line: {gpu_count_line}")
            logging.warning(f"  Memory line: {memory_line}")
            continue
    
    return tasks


def _parse_number(line: str) -> int:
    """从行中解析数字（支持数字后跟注释）"""
    # 找到第一个数字字符的位置
    for i, char in enumerate(line):
        if char.isdigit():
            line = line[i:]
            break
    # 移除数字后的注释（如果有的话）
    line = line.split()[0]  # 只取第一个数字
    return int(line.strip())
