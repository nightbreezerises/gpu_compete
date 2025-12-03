#!/usr/bin/env python3
"""
Multi-GPU Competition Script - 多GPU竞争调度器
Manages multi-GPU resource allocation based on available memory

核心特性：
- 队内串行：同一队列的任务严格按顺序执行
- 队间并行：不同队列的任务可以同时在不同 GPU 上执行
- 支持任务使用多张GPU
- 重试机制：任务失败后根据配置进行重试和退避

模块结构：
- utils/gpu_monitor.py: GPU 状态监控
- utils/retry.py: 重试机制
- utils/gpus_command_file.py: 多GPU命令文件解析
- command_gpus.txt: 多GPU任务配置文件
"""

import os
import sys
import time
import subprocess
import logging
import argparse
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
import psutil
import threading
import concurrent.futures

# 添加当前目录到 Python 路径
# 脚本目录（app目录的父目录）
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPT_DIR)

# 导入工具模块
from app.utils.gpu_monitor import GPUMonitor
from app.utils.retry import RetryConfig
from app.utils.gpus_command_file import parse_command_file
from app.utils.process_yaml import ProcessYAML, load_config_with_args, parse_command_file_path, resolve_work_dir
from app.utils.gpu_select import GPUSelector, select_gpus
from app.utils.update_state import StatusWriter, get_status_writer

# 运行方式:
# nohup python main_gpus.py > /dev/null 2>&1 &
# nohup python main_gpus.py --command-file /path/to/custom_command_gpus.txt > /dev/null 2>&1 &

# =============================================================================
# 命令行参数解析
# =============================================================================

def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='Multi-GPU Competition Script - 多GPU竞争调度器')
    parser.add_argument('--command-file', 
                       type=str,
                       help='命令配置文件路径（默认: command/command_gpus.txt）',
                       default=None)
    parser.add_argument('--config-file',
                       type=str,
                       help='YAML配置文件路径（默认: config.yaml）',
                       default=None)
    parser.add_argument('--config-index',
                       type=int,
                       help='配置索引（用于状态跟踪）',
                       default=0)
    return parser.parse_args()

# 解析命令行参数
args = parse_arguments()

# =============================================================================
# 配置项
# =============================================================================

# 日志目录配置
log_dir = os.path.join(SCRIPT_DIR, 'logs')  # 使用项目根目录下的 logs 目录

# 命令文件路径：优先使用命令行参数，否则使用默认路径
commands_path = parse_command_file_path(args, SCRIPT_DIR, 'command/command_gpus.txt')

# 加载配置
config_processor, config = load_config_with_args(args, SCRIPT_DIR, 'config/gpu_manage.yaml')

# 工作目录配置（支持相对路径和绝对路径）
work_dir = resolve_work_dir(config, SCRIPT_DIR)

# 调度配置
check_time = config.get('check_time', 5)  # 调度间隔（秒）
maximize_resource_utilization = config.get('maximize_resource_utilization', False)  # 极限利用资源模式
memory_save_mode = config.get('memory_save_mode', True)  # GPU选择模式：True=节省显存，False=防止溢出

# GPU 配置
compete_gpus = config.get('compete_gpus', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])  # 手动指定的 GPU 列表
use_all_gpus = config.get('use_all_gpus', True)  # 是否自动探测所有 GPU
gpu_left = config.get('gpu_left', 0)  # 剩余几张卡给其他用户
min_gpu = config.get('min_gpu', 3)  # 用户至少用几张卡
max_gpu = config.get('max_gpu', 8)  # 用户最多用几张卡

# 重试配置
retry_config_dict = config.get('retry_config', {})
retry_config = RetryConfig(
    max_retry_before_backoff=retry_config_dict.get('max_retry_before_backoff', 3),  # 每 3 次重试后进入退避
    backoff_duration=retry_config_dict.get('backoff_duration', 600)         # 退避时间 10 分钟
)



# =============================================================================
# 任务数据结构（多GPU版本）
# =============================================================================

@dataclass
class Task:
    """多GPU任务数据结构"""
    commands: List[str]          # 命令列表（串行执行）
    queue_id: int                # 队列 ID
    gpu_count: int               # GPU 数量需求
    estimated_memory_gb: int     # 每张GPU预估显存 (GB)
    status: str = "pending"      # pending / running / completed / failed
    assigned_gpus: List[int] = field(default_factory=list)  # 分配的 GPU ID 列表
    retry_count: int = 0         # 重试次数
    backoff_until: float = 0     # 退避结束时间戳
    error_type: str = ""         # 错误类型


class MultiGPUCompetitor:
    """多GPU竞争调度器 - 核心类
    
    核心逻辑：队列内串行，队列间并行
    - 同一队列的任务严格按顺序执行
    - 不同队列的任务可以并行执行（在不同 GPU 上）
    - 支持任务使用多张GPU
    - 使用线程池实现队间并行
    """
    
    def __init__(self):
        # 初始化日志
        self._setup_logging()
        
        # 初始化 GPU 列表（动态预留：可以在所有卡上运行）
        if use_all_gpus:
            all_gpus = GPUMonitor.detect_gpus()
        else:
            all_gpus = compete_gpus
        
        # 动态预留模式：所有GPU都可以使用，运行时动态计算可用配额
        self.gpus = all_gpus
        self.total_gpus = len(all_gpus)
        
        # 保存配置到实例变量
        self.gpu_left = gpu_left
        self.min_gpu = min_gpu
        self.max_gpu = max_gpu
        
        logging.info(f"🖥️ Total GPUs available: {self.gpus}")
        logging.info(f"🖥️ Dynamic reservation config: gpu_left={gpu_left}, min_gpu={min_gpu}, max_gpu={max_gpu}")
        
        # 线程同步
        self.gpu_lock = threading.Lock()  # GPU 分配锁
        self.queue_locks: Dict[int, threading.Lock] = {}  # 每个队列一个锁
        
        # GPU 占用状态（调度器内部维护，不依赖nvidia-smi检测延迟）
        self.occupied_gpus: Dict[int, int] = {}  # gpu_id -> queue_id（正在使用该GPU的队列）
        
        # 队列执行状态
        self.queue_futures: Dict[int, concurrent.futures.Future] = {}  # 队列 -> Future
        
        # 初始化任务队列
        self.tasks: List[Task] = []
        self.queues: Dict[int, List[Task]] = {}  # queue_id -> [tasks]
        self._setup_tasks()
        
        # 运行状态
        self.running = True
        
        # 状态写入器
        self.status_writer: StatusWriter = None
    
    def _setup_logging(self):
        """配置日志"""
        log_file = self._get_next_log_file()
        
        # 清除现有的处理器
        root_logger = logging.getLogger()
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # 配置新的处理器
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ],
            force=True
        )
        logging.info(f"📝 Log file: {log_file}")
        logging.info(f"📄 Command file: {commands_path}")
    
    def _get_next_log_file(self) -> str:
        """获取下一个日志文件名"""
        base = os.path.join(log_dir, 'compete_gpus')  # 多GPU专用日志
        if not os.path.exists(f"{base}.log"):
            return f"{base}.log"
        i = 1
        while os.path.exists(f"{base}({i}).log"):
            i += 1
        return f"{base}({i}).log"
    
    def _setup_tasks(self):
        """从命令文件初始化任务列表（多GPU版本）"""
        command_tasks = parse_command_file(commands_path)
        
        if not command_tasks:
            logging.warning(f"No tasks found in {commands_path}")
            return
        
        for commands, queue_id, gpu_count, memory in command_tasks:
            task = Task(
                commands=commands,
                queue_id=queue_id,
                gpu_count=gpu_count,
                estimated_memory_gb=memory
            )
            self.tasks.append(task)
            
            if queue_id not in self.queues:
                self.queues[queue_id] = []
            self.queues[queue_id].append(task)
        
        logging.info(f"📋 Total tasks: {len(self.tasks)}, Queues: {list(self.queues.keys())}")
        for qid, tasks in self.queues.items():
            gpu_counts = [t.gpu_count for t in tasks]
            logging.info(f"   Queue {qid}: {len(tasks)} tasks, GPU needs: {gpu_counts}")
            # 为每个队列创建锁
            self.queue_locks[qid] = threading.Lock()
    
    def _get_current_user_gpu_count(self) -> int:
        """获取当前用户正在使用的GPU数量（调度器内部占用 + 外部进程占用）"""
        user_gpu_count = 0
        for gpu_id in self.gpus:
            # 检查调度器内部占用
            if gpu_id in self.occupied_gpus:
                user_gpu_count += 1
                continue
            # 检查外部用户进程
            user_procs = GPUMonitor.get_user_processes_on_gpu(gpu_id)
            if user_procs:
                user_gpu_count += 1
        return user_gpu_count
    
    def _get_max_allowed_gpus(self) -> int:
        """动态计算当前允许使用的最大GPU数量
        
        公式：min(max_gpu, max(min_gpu, available_gpus - gpu_left))
        其中 available_gpus 是当前显存充足的GPU数量（不考虑用户占用）
        """
        # 统计显存充足的GPU数量（available_gpus）
        available_gpus = 0
        for gpu_id in self.gpus:
            available_mem = GPUMonitor.get_available_memory(gpu_id)
            if available_mem >= 1:  # 至少1GB可用显存才算可用
                available_gpus += 1
        
        # 计算允许使用的最大GPU数量
        max_allowed = min(self.max_gpu, max(self.min_gpu, available_gpus - self.gpu_left))
        return max(0, max_allowed)
    
    def _can_acquire_more_gpus(self, count: int = 1) -> bool:
        """检查是否可以再获取更多GPU
        
        Args:
            count: 需要获取的GPU数量
        """
        current_used = self._get_current_user_gpu_count()
        max_allowed = self._get_max_allowed_gpus()
        return current_used + count <= max_allowed

    def find_available_gpus(self, gpu_count: int, required_memory: int, queue_id: int = -1) -> Optional[List[int]]:
        """查找多个可用的 GPU
        
        条件：
        1. 动态预留检查：当前用户使用的GPU数量未超过允许的最大值
        2. 有足够的显存
        3. 非极限模式下：
           a. 调度器内部没有其他任务正在使用该GPU
           b. 当前用户没有其他 Python 进程在该 GPU 上（外部进程）
        4. 多个可用GPU时，使用智能选择策略
        
        Args:
            gpu_count: 需要的 GPU 数量
            required_memory: 每张 GPU 需要的显存 (GB)
            queue_id: 请求GPU的队列ID（用于日志）
            
        Returns:
            可用的 GPU ID 列表，如果不足则返回 None
        """
        # 动态预留检查：是否还能获取更多GPU
        if not self._can_acquire_more_gpus(gpu_count):
            current_used = self._get_current_user_gpu_count()
            max_allowed = self._get_max_allowed_gpus()
            logging.debug(f"Dynamic reservation limit reached: using {current_used}/{max_allowed} GPUs, need {gpu_count} more")
            return None
        
        # 第一步：筛选出所有满足条件的GPU
        candidate_gpus = []
        for gpu_id in self.gpus:
            # 非极限模式：检查调度器内部占用
            if not maximize_resource_utilization:
                if gpu_id in self.occupied_gpus:
                    occupying_queue = self.occupied_gpus[gpu_id]
                    logging.debug(f"GPU {gpu_id}: occupied by queue {occupying_queue} (internal)")
                    continue
            
            # 检查显存
            available = GPUMonitor.get_available_memory(gpu_id)
            if available < required_memory:
                logging.debug(f"GPU {gpu_id}: insufficient memory ({available:.1f}GB < {required_memory}GB)")
                continue
            
            # 非极限模式：检查外部用户进程
            if not maximize_resource_utilization:
                user_procs = GPUMonitor.get_user_processes_on_gpu(gpu_id)
                if user_procs:
                    logging.debug(f"GPU {gpu_id}: external user processes exist {user_procs}")
                    continue
            
            candidate_gpus.append(gpu_id)
        
        # 检查是否有足够的候选GPU
        if len(candidate_gpus) < gpu_count:
            logging.debug(f"Only found {len(candidate_gpus)} GPUs, need {gpu_count}")
            return None
        
        # 第二步：如果候选GPU数量刚好等于需求，直接返回
        if len(candidate_gpus) == gpu_count:
            logging.info(f"✅ Found exactly {gpu_count} GPUs: {candidate_gpus}")
            return candidate_gpus
        
        # 第三步：多个候选GPU时，使用智能选择策略（高频采样）
        logging.info(f"🔍 发现 {len(candidate_gpus)} 个候选GPU: {candidate_gpus}，需要 {gpu_count} 个，启动智能选择...")
        
        best_gpus = select_gpus(
            gpu_ids=candidate_gpus,
            count=gpu_count,
            memory_save_mode=memory_save_mode,
            required_memory=required_memory,
            use_sampling=True  # 使用3秒30次采样
        )
        
        if len(best_gpus) >= gpu_count:
            return best_gpus[:gpu_count]
        
        # 如果智能选择返回的GPU不足，回退到前N个候选GPU
        logging.warning(f"智能选择返回 {len(best_gpus)} 个GPU，不足 {gpu_count} 个，回退到候选列表")
        return candidate_gpus[:gpu_count]
    
    def _acquire_gpus(self, gpu_ids: List[int], queue_id: int):
        """标记多个GPU为已占用"""
        with self.gpu_lock:
            for gpu_id in gpu_ids:
                self.occupied_gpus[gpu_id] = queue_id
            logging.info(f"🔒 GPUs {gpu_ids} acquired by queue {queue_id}")
    
    def _release_gpus(self, gpu_ids: List[int], queue_id: int):
        """释放多个GPU占用"""
        with self.gpu_lock:
            for gpu_id in gpu_ids:
                if gpu_id in self.occupied_gpus and self.occupied_gpus[gpu_id] == queue_id:
                    del self.occupied_gpus[gpu_id]
            logging.info(f"🔓 GPUs {gpu_ids} released by queue {queue_id}")
    
    def get_busy_queues(self) -> set:
        """获取当前正在运行任务的队列 ID 集合
        
        直接检查任务状态
        """
        busy = set()
        for task in self.tasks:
            if task.status == "running":
                busy.add(task.queue_id)
        return busy
    
    def get_occupied_gpus(self) -> set:
        """获取当前被占用的 GPU 集合（非极限模式下）"""
        if maximize_resource_utilization:
            return set()
        
        occupied = set()
        for gpu_id in self.gpus:
            user_procs = GPUMonitor.get_user_processes_on_gpu(gpu_id)
            if user_procs:
                occupied.add(gpu_id)
        return occupied
    
    def get_queue_head_task(self, queue_id: int) -> Optional[Task]:
        """获取队列的第一个 pending 任务"""
        for task in self.queues.get(queue_id, []):
            if task.status == "pending":
                return task
        return None
    
    def execute_task(self, task: Task, gpu_ids: List[int]) -> bool:
        """执行多GPU任务（同步执行所有命令）
        
        Args:
            task: 任务对象
            gpu_ids: 分配的 GPU ID 列表
            
        Returns:
            True 如果所有命令成功执行
            False 如果任何命令失败（会触发重试机制）
        """
        task.assigned_gpus = gpu_ids
        task.status = "running"
        
        # 构建 CUDA_VISIBLE_DEVICES 字符串
        cuda_devices = ','.join(map(str, gpu_ids))
        
        logging.info(f"🚀 Starting task (Queue {task.queue_id}, retry={task.retry_count}) on GPUs {gpu_ids}")
        
        for i, cmd_template in enumerate(task.commands):
            # 替换变量
            cmd = cmd_template.format(work_dir=work_dir)
            
            # 在命令前添加 CUDA_VISIBLE_DEVICES 环境变量
            # 使用绝对路径初始化 conda，避免 HOME 环境变量问题
            home_dir = os.path.expanduser('~')
            conda_sh = f"{home_dir}/miniconda3/etc/profile.d/conda.sh"
            full_cmd = f"source {conda_sh} && export CUDA_VISIBLE_DEVICES={cuda_devices} && {cmd}"
            
            logging.info(f"   [{i+1}/{len(task.commands)}] [GPUs {cuda_devices}] {cmd[:80]}...")
            
            try:
                # 确保 HOME 环境变量被正确设置
                env = os.environ.copy()
                env['HOME'] = home_dir
                
                result = subprocess.run(
                    full_cmd,
                    shell=True,
                    executable='/bin/bash',
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=7200,  # 2小时超时
                    env=env
                )
                
                if result.returncode != 0:
                    error_msg = result.stderr[:500] if result.stderr else "Unknown error"
                    logging.error(f"   ❌ Command failed (exit code {result.returncode}): {error_msg}")
                    # 触发重试机制
                    self._handle_task_failure(task, f"exit_code_{result.returncode}")
                    return False
                
                # 打印输出（简化）
                if result.stdout.strip():
                    for line in result.stdout.strip().split('\n')[:5]:
                        logging.info(f"   > {line[:100]}")
                        
            except subprocess.TimeoutExpired:
                logging.error(f"   ❌ Command timeout (2h)")
                self._handle_task_failure(task, "timeout")
                return False
            except Exception as e:
                logging.error(f"   ❌ Command error: {e}")
                self._handle_task_failure(task, str(type(e).__name__))
                return False
        
        task.status = "completed"
        logging.info(f"✅ Task (Queue {task.queue_id}) completed successfully")
        return True
    
    def _handle_task_failure(self, task: Task, error_type: str):
        """处理任务失败，应用重试机制"""
        task.retry_count += 1
        task.error_type = error_type
        
        # 检查是否需要退避
        if task.retry_count % retry_config.max_retry_before_backoff == 0:
            task.backoff_until = time.time() + retry_config.backoff_duration
            task.status = "pending"
            logging.warning(
                f"🔄 Task (Queue {task.queue_id}) failed (retry #{task.retry_count}, error={error_type}), "
                f"entering backoff for {retry_config.backoff_duration // 60} minutes"
            )
        else:
            task.status = "pending"
            logging.warning(
                f"🔄 Task (Queue {task.queue_id}) failed (retry #{task.retry_count}, error={error_type}), "
                f"will retry soon"
            )
    
    def print_status(self):
        """打印当前状态"""
        pending = sum(1 for t in self.tasks if t.status == "pending")
        running = sum(1 for t in self.tasks if t.status == "running")
        completed = sum(1 for t in self.tasks if t.status == "completed")
        failed = sum(1 for t in self.tasks if t.status == "failed")
        
        logging.info("=" * 60)
        logging.info(f"📊 Tasks: Pending={pending}, Running={running}, Completed={completed}, Failed={failed}")
        
        busy_queues = self.get_busy_queues()
        for qid in sorted(self.queues.keys()):
            status = "🔴 BUSY" if qid in busy_queues else "🟢 IDLE"
            q_pending = sum(1 for t in self.queues[qid] if t.status == "pending")
            q_completed = sum(1 for t in self.queues[qid] if t.status == "completed")
            logging.info(f"   Queue {qid}: {status}, Pending={q_pending}, Completed={q_completed}")
        
        logging.info("=" * 60)
    
    def _run_queue(self, queue_id: int):
        """运行单个队列的所有任务（队内串行）
        
        Args:
            queue_id: 队列 ID
        """
        tasks = self.queues.get(queue_id, [])
        logging.info(f"🚀 Queue {queue_id}: Starting with {len(tasks)} tasks")
        
        for task_idx, task in enumerate(tasks):
            if not self.running:
                logging.info(f"🛑 Queue {queue_id}: Scheduler stopped")
                break
            
            # 检查任务是否已完成
            if task.status == "completed":
                logging.info(f"⏭️ Queue {queue_id}: Task {task_idx+1}/{len(tasks)} already completed, skipping")
                continue
            
            # 执行任务（带重试）
            success = self._execute_task_with_retry(task, queue_id, task_idx, len(tasks))
            
            if not success:
                logging.error(f"❌ Queue {queue_id}: Task {task_idx+1}/{len(tasks)} failed after all retries, stopping queue")
                break
        
        # 队列完成
        completed = sum(1 for t in tasks if t.status == "completed")
        logging.info(f"🏁 Queue {queue_id}: Finished. Completed {completed}/{len(tasks)} tasks")
        
        # 更新状态：队列完成
        if self.status_writer:
            if completed == len(tasks):
                self.status_writer.on_queue_complete(queue_id)
            else:
                self.status_writer.on_queue_fail(queue_id, f"Completed {completed}/{len(tasks)} tasks")
    
    def _execute_task_with_retry(self, task: Task, queue_id: int, task_idx: int, total_tasks: int) -> bool:
        """执行任务，带重试机制
        
        Returns:
            True 如果任务最终成功
            False 如果任务失败且无法重试
        """
        max_total_retries = 100  # 最大总重试次数，防止无限循环
        
        while task.retry_count < max_total_retries:
            if not self.running:
                return False
            
            # 检查退避
            if task.backoff_until > 0 and time.time() < task.backoff_until:
                wait_time = task.backoff_until - time.time()
                logging.info(f"⏳ Queue {queue_id}: Task {task_idx+1}/{total_tasks} in backoff, waiting {wait_time:.0f}s")
                time.sleep(min(wait_time, 60))  # 每次最多等60秒，然后重新检查
                continue
            
            # 等待并获取可用 GPU（会立即标记为占用）
            gpu_ids = self._wait_for_gpus(task.gpu_count, task.estimated_memory_gb, queue_id)
            if gpu_ids is None:
                logging.error(f"❌ Queue {queue_id}: Cannot find available GPUs, stopping")
                return False
            
            # 执行任务
            logging.info(f"🎯 Queue {queue_id}: Executing task {task_idx+1}/{total_tasks} on GPUs {gpu_ids} (retry={task.retry_count})")
            
            # 更新状态：任务开始
            if self.status_writer:
                cmd_preview = task.commands[0][:50] if task.commands else ""
                self.status_writer.on_task_start(queue_id, task_idx, total_tasks, gpu_ids[0], cmd_preview)
                # 更新进程级状态
                from datetime import datetime
                self.status_writer.update_process_status(
                    queue_id, task_idx,
                    status="running",
                    current_gpu=gpu_ids[0],
                    gpus=gpu_ids,
                    retry_count=task.retry_count,
                    started_at=datetime.now().isoformat()
                )
            
            try:
                success = self.execute_task(task, gpu_ids)
            finally:
                # 任务完成后释放GPU
                self._release_gpus(gpu_ids, queue_id)
            
            if success:
                # 更新状态：任务成功
                if self.status_writer:
                    self.status_writer.on_task_success(queue_id, task_idx, total_tasks, gpu_ids[0])
                    # 更新进程级状态
                    from datetime import datetime
                    self.status_writer.update_process_status(
                        queue_id, task_idx,
                        status="completed",
                        current_gpu=None,
                        gpus=[],
                        finished_at=datetime.now().isoformat()
                    )
                return True
            
            # 任务失败，检查是否可以重试
            if task.status == "pending":
                logging.info(f"🔄 Queue {queue_id}: Task {task_idx+1}/{total_tasks} will retry (count={task.retry_count})")
                # 更新状态：任务失败但会重试
                if self.status_writer:
                    self.status_writer.on_task_fail(queue_id, task_idx, total_tasks, gpu_ids[0], task.error_type, will_retry=True)
                    # 更新进程级状态
                    self.status_writer.update_process_status(
                        queue_id, task_idx,
                        status="retrying",
                        current_gpu=None,
                        gpus=[],
                        retry_count=task.retry_count,
                        last_error=task.error_type
                    )
                time.sleep(5)  # 短暂等待后重试
            else:
                # 任务状态不是 pending，说明不应该重试
                # 更新状态：任务失败且不会重试
                if self.status_writer:
                    self.status_writer.on_task_fail(queue_id, task_idx, total_tasks, gpu_ids[0], task.error_type, will_retry=False)
                    # 更新进程级状态
                    from datetime import datetime
                    self.status_writer.update_process_status(
                        queue_id, task_idx,
                        status="failed",
                        current_gpu=None,
                        gpus=[],
                        last_error=task.error_type,
                        finished_at=datetime.now().isoformat()
                    )
                return False
        
        logging.error(f"❌ Queue {queue_id}: Task {task_idx+1}/{total_tasks} exceeded max retries ({max_total_retries})")
        return False
    
    def _wait_for_gpus(self, gpu_count: int, required_memory: int, queue_id: int, timeout: int = 3600) -> Optional[List[int]]:
        """等待可用的多个 GPU 并立即标记为占用
        
        Args:
            gpu_count: 需要的 GPU 数量
            required_memory: 每张 GPU 需要的显存 (GB)
            queue_id: 请求GPU的队列ID
            timeout: 超时时间（秒），默认1小时
            
        Returns:
            可用的 GPU ID 列表，如果超时返回 None
        """
        start_time = time.time()
        last_log_time = 0
        
        while time.time() - start_time < timeout:
            if not self.running:
                return None
            
            with self.gpu_lock:
                gpu_ids = self.find_available_gpus(gpu_count, required_memory, queue_id)
                if gpu_ids is not None:
                    # 立即标记为占用，防止其他队列抢占
                    for gpu_id in gpu_ids:
                        self.occupied_gpus[gpu_id] = queue_id
                    logging.info(f"🔒 GPUs {gpu_ids} acquired by queue {queue_id}")
                    return gpu_ids
            
            # 没有足够的可用 GPU，每check_time秒输出一次等待日志
            elapsed = time.time() - start_time
            if time.time() - last_log_time >= check_time:
                # 动态预留状态
                current_used = self._get_current_user_gpu_count()
                max_allowed = self._get_max_allowed_gpus()
                
                # 检查所有GPU的状态，输出详细信息
                gpu_status = []
                for gpu_id in self.gpus:
                    available = GPUMonitor.get_available_memory(gpu_id)
                    is_occupied = gpu_id in self.occupied_gpus
                    user_procs = GPUMonitor.get_user_processes_on_gpu(gpu_id) if not maximize_resource_utilization else []
                    status = "🔴" if (is_occupied or user_procs) else "🟢"
                    gpu_status.append(f"GPU{gpu_id}: {status} ({available:.1f}GB)")
                
                logging.info(
                    f"⏳ Queue {queue_id}: Waiting for {gpu_count} GPUs ({required_memory}GB each, "
                    f"using {current_used}/{max_allowed} GPUs, elapsed {elapsed:.0f}s) - {' | '.join(gpu_status)}"
                )
                last_log_time = time.time()
            
            # 等待后重试
            time.sleep(check_time)
        
        logging.warning(f"⏰ Timeout waiting for {gpu_count} GPUs with {required_memory}GB memory each")
        return None
    
    def init_status_writer(self, config_index: int = 0):
        """初始化状态写入器"""
        status_dir = os.path.join(SCRIPT_DIR, 'logs', 'status')
        self.status_writer = StatusWriter(
            status_dir=status_dir,
            mode="multi",
            config_index=config_index,
            config_file=commands_path
        )
        
        # 设置 GPU 信息
        all_gpus = GPUMonitor.detect_gpus() if use_all_gpus else compete_gpus
        self.status_writer.set_gpus(self.gpus, all_gpus)
        
        # 初始化队列信息
        queue_task_counts = {qid: len(tasks) for qid, tasks in self.queues.items()}
        self.status_writer.init_queues(queue_task_counts)
        
        # 初始化每个队列的进程信息
        for qid, tasks in self.queues.items():
            processes = []
            for task in tasks:
                processes.append({
                    "commands": task.commands,
                    "memory_gb": task.estimated_memory_gb,
                    "gpu_count": task.gpu_count
                })
            self.status_writer.init_queue_processes(qid, processes)
        
        # 设置运行状态
        self.status_writer.set_state("running")
    
    def run(self):
        """主调度循环（多GPU版本）
        
        核心逻辑：
        - 队内串行：每个队列的任务按顺序执行
        - 队间并行：不同队列使用线程池并行执行
        """
        logging.info("🏁 Starting Multi-GPU competition scheduler")
        self.print_status()
        
        if not self.queues:
            logging.warning("⚠️ No queues to process")
            return
        
        try:
            # 使用线程池并行执行所有队列
            max_workers = min(len(self.queues), len(self.gpus))
            logging.info(f"🔧 Starting {len(self.queues)} queues with {max_workers} workers")
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                # 提交所有队列任务
                futures = {}
                for queue_id in self.queues.keys():
                    future = executor.submit(self._run_queue, queue_id)
                    futures[future] = queue_id
                    self.queue_futures[queue_id] = future
                
                # 等待所有队列完成
                for future in concurrent.futures.as_completed(futures):
                    queue_id = futures[future]
                    try:
                        future.result()
                        logging.info(f"✅ Queue {queue_id} completed")
                    except Exception as e:
                        logging.error(f"❌ Queue {queue_id} failed with exception: {e}")
            
            # 打印最终状态
            self.print_status()
            logging.info("🎉 All queues finished!")
            
            # 更新状态为完成
            if self.status_writer:
                self.status_writer.set_state("completed")
            
        except KeyboardInterrupt:
            logging.info("🛑 Received interrupt signal, stopping...")
            self.running = False
            if self.status_writer:
                self.status_writer.set_state("stopping")
        except Exception as e:
            logging.error(f"❌ Scheduler error: {e}")
            if self.status_writer:
                self.status_writer.set_error(str(e))
                self.status_writer.set_state("failed")
            raise


def main():
    """主函数"""
    competitor = MultiGPUCompetitor()
    competitor.init_status_writer(config_index=args.config_index)
    competitor.run()


if __name__ == "__main__":
    main()