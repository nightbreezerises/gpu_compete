#!/usr/bin/env python3
"""
Multi-GPU Competition Script - 多GPU竞争调度器
Manages multi-GPU resource allocation based on available memory

模块结构：
- utils/gpu_monitor.py: GPU 状态监控
- utils/process_json.py: JSON 文件管理
- utils/retry.py: 重试机制
- utils/gpus_command_file.py: 多GPU命令文件解析
- command_gpus.txt: 多GPU任务配置文件

核心特性：
- 支持任务使用多张GPU
- 优先调度GPU需求量大的任务
- 其次优先调度队列ID小的任务
"""

import os
import sys
import time
import subprocess
import logging
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
import psutil

# 添加当前目录到 Python 路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

# 导入工具模块
from utils.gpu_monitor import GPUMonitor
from utils.process_json import ProcessJSON
from utils.retry import RetryConfig, is_task_ready, handle_task_retry, generate_uni_id
from utils.gpus_command_file import parse_command_file
from utils.process_yaml import ProcessYAML
from utils.gpu_select import GPUSelector, select_gpus

# 运行方式:
# nohup python main_gpus.py > /dev/null 2>&1 &

# =============================================================================
# 配置项
# =============================================================================

# 路径配置（相对于脚本位置）
log_dir = os.path.join(SCRIPT_DIR, 'logs')
process_json_path = os.path.join(SCRIPT_DIR, 'logs', 'uni_id_gpus.json')  # 多GPU专用JSON
config_path = os.path.join(SCRIPT_DIR, 'config.yaml')   # YAML 配置文件路径

# 加载配置
config_processor = ProcessYAML(config_path)
config = config_processor.get_config()

# 工作目录配置（支持相对路径和绝对路径）
work_dir_config = config.get('work_dir')
if work_dir_config:
    # 如果配置了 work_dir，解析为绝对路径
    if os.path.isabs(work_dir_config):
        work_dir = work_dir_config
    else:
        # 相对路径：相对于脚本位置
        work_dir = os.path.abspath(os.path.join(SCRIPT_DIR, work_dir_config))
else:
    # 默认：脚本父目录
    work_dir = os.path.dirname(SCRIPT_DIR)

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

# 命令文件配置
gpus_command_file = config.get('gpus_command_file', 'command_gpus.txt')
commands_path = os.path.join(SCRIPT_DIR, gpus_command_file)


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
    uni_id: str = ""             # 唯一标识符
    status: str = "pending"      # pending / running / completed / failed
    assigned_gpus: List[int] = field(default_factory=list)  # 分配的 GPU ID 列表
    pid: int = 0                 # Python 进程 PID
    retry_count: int = 0         # 重试次数
    backoff_until: float = 0     # 退避结束时间戳
    error_type: str = ""         # 错误类型


class MultiGPUCompetitor:
    """多GPU竞争调度器 - 核心类
    
    核心逻辑：队列内串行，队列间并行，优先大任务
    - 同一队列的任务严格按顺序执行
    - 不同队列的任务可以并行执行（在不同 GPU 上）
    - 优先调度GPU需求量大的任务
    - 其次优先调度队列ID小的任务
    - 每次只分配一个任务，等待确认后再分配下一个
    """
    
    def __init__(self):
        # 初始化日志
        self._setup_logging()
        
        # 初始化 GPU 列表
        if use_all_gpus:
            all_gpus = GPUMonitor.detect_gpus()
        else:
            all_gpus = compete_gpus
        
        # 计算可用 GPU 数量：min(max_gpu, max(min_gpu, available_gpus - gpu_left))
        available_after_reservation = len(all_gpus) - gpu_left if len(all_gpus) > gpu_left else 0
        min_required = max(min_gpu, available_after_reservation)
        target_gpu_count = min(max_gpu, min_required)
        
        # 确保不超过实际可用的 GPU 数量
        target_gpu_count = min(target_gpu_count, len(all_gpus))
        
        # 应用 GPU 分配逻辑
        if target_gpu_count < len(all_gpus):
            # 从前面取 target_gpu_count 张卡
            self.gpus = all_gpus[:target_gpu_count]
            reserved_gpus = all_gpus[target_gpu_count:]
            # 记录预留的 GPU（包括 gpu_left 和多余的）
            logging.info(f"🖥️ Using {len(self.gpus)}/{len(all_gpus)} GPUs: {self.gpus}")
            logging.info(f"🖥️ Reserved GPUs: {reserved_gpus} (gpu_left={gpu_left}, excess={len(reserved_gpus)-gpu_left})")
        else:
            self.gpus = all_gpus
            logging.info(f"🖥️ Using all {len(self.gpus)} GPUs: {self.gpus}")
        
        # 保存配置到实例变量
        self.gpu_left = gpu_left
        self.min_gpu = min_gpu
        self.max_gpu = max_gpu
        self.total_gpus = len(all_gpus)
        
        # 初始化 JSON 管理器
        self.process_json = ProcessJSON(process_json_path)
        
        # 初始化任务队列
        self.tasks: List[Task] = []
        self.queues: Dict[int, List[Task]] = {}  # queue_id -> [tasks]
        self._setup_tasks()
        
        # 运行状态
        self.running = True
        
        # 配置
        self.task_start_delay = 30  # 每个任务启动后等待秒数
    
    def _setup_logging(self):
        """配置日志"""
        os.makedirs(log_dir, exist_ok=True)
        log_file = self._get_next_log_file()
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        logging.info(f"📝 Log file: {log_file}")
    
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
                estimated_memory_gb=memory,
                uni_id=generate_uni_id()
            )
            self.tasks.append(task)
            
            if queue_id not in self.queues:
                self.queues[queue_id] = []
            self.queues[queue_id].append(task)
        
        logging.info(f"📋 Total tasks: {len(self.tasks)}, Queues: {list(self.queues.keys())}")
        for qid, tasks in self.queues.items():
            gpu_counts = [t.gpu_count for t in tasks]
            logging.info(f"   Queue {qid}: {len(tasks)} tasks, GPU needs: {gpu_counts}")
    
    def find_available_gpus(self, gpu_count: int, required_memory: int, exclude_gpus: Set[int] = None) -> Optional[List[int]]:
        """查找多个可用的 GPU
        
        条件：
        1. 有足够的显存
        2. 非极限模式下，当前用户没有其他 Python 进程在该 GPU 上
        3. 多个可用GPU时，使用智能选择策略
        
        Args:
            gpu_count: 需要的 GPU 数量
            required_memory: 每张 GPU 需要的显存 (GB)
            exclude_gpus: 排除的 GPU 集合
            
        Returns:
            可用的 GPU ID 列表，如果不足则返回 None
        """
        exclude_gpus = exclude_gpus or set()
        
        # 第一步：筛选出所有满足条件的GPU
        candidate_gpus = []
        for gpu_id in self.gpus:
            if gpu_id in exclude_gpus:
                continue
            
            # 检查显存
            available = GPUMonitor.get_available_memory(gpu_id)
            if available < required_memory:
                logging.debug(f"GPU {gpu_id}: insufficient memory ({available:.1f}GB < {required_memory}GB)")
                continue
            
            # 非极限模式：检查用户进程
            if not maximize_resource_utilization:
                user_procs = GPUMonitor.get_user_processes_on_gpu(gpu_id)
                if user_procs:
                    logging.debug(f"GPU {gpu_id}: user processes exist {user_procs}")
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
    
    def get_busy_queues(self) -> set:
        """获取当前正在运行任务的队列 ID 集合
        
        通过检查 JSON 中 state=running 且进程确实存在的记录
        """
        busy = set()
        running = self.process_json.get_running_processes()
        
        for uni_id, record in running.items():
            pid = record.get('pid', 0)
            if pid > 0 and psutil.pid_exists(pid):
                # 找到对应的任务获取队列 ID
                for task in self.tasks:
                    if task.uni_id == uni_id:
                        busy.add(task.queue_id)
                        break
        
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
            True 如果任务成功启动（bash 脚本已启动后台进程）
        """
        task.assigned_gpus = gpu_ids
        task.status = "running"
        
        # 构建 CUDA_VISIBLE_DEVICES 字符串
        cuda_devices = ','.join(map(str, gpu_ids))
        
        logging.info(f"🚀 Starting task {task.uni_id} (Queue {task.queue_id}) on GPUs {gpu_ids}")
        
        for i, cmd_template in enumerate(task.commands):
            # 替换变量
            cmd = cmd_template.format(
                work_dir=work_dir,
                uni_id=task.uni_id
            )
            
            # 在命令前添加 CUDA_VISIBLE_DEVICES 环境变量（确保子进程继承）
            full_cmd = f"CUDA_VISIBLE_DEVICES={cuda_devices} {cmd}"
            
            logging.info(f"   [{i+1}/{len(task.commands)}] [GPUs {cuda_devices}] {cmd[:80]}...")
            
            try:
                result = subprocess.run(
                    full_cmd, shell=True, capture_output=True, text=True, timeout=300
                )
                
                if result.returncode != 0:
                    logging.error(f"   Command failed: {result.stderr[:200]}")
                    task.status = "failed"
                    return False
                
                # 打印输出（简化）
                if result.stdout.strip():
                    for line in result.stdout.strip().split('\n')[:5]:
                        logging.info(f"   > {line[:100]}")
                        
            except subprocess.TimeoutExpired:
                logging.error(f"   Command timeout")
                task.status = "failed"
                return False
            except Exception as e:
                logging.error(f"   Command error: {e}")
                task.status = "failed"
                return False
        
        task.status = "completed"
        logging.info(f"✅ Task {task.uni_id} commands completed, waiting for background process...")
        return True
    
    def wait_for_process_start(self, task: Task, timeout: int = 60) -> bool:
        """等待任务的 Python 进程真正启动
        
        通过检查 JSON 中的 PID 是否有效来确认
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            record = self.process_json.get_record(task.uni_id)
            if record:
                pid = record.get('pid', 0)
                state = record.get('state', '')
                
                if state == 'running' and pid > 0 and psutil.pid_exists(pid):
                    task.pid = pid
                    logging.info(f"✅ Process confirmed: {task.uni_id} PID={pid}")
                    return True
                elif state in ('normal_exit', 'abnormal_exit'):
                    logging.warning(f"⚠️ Process already exited: {task.uni_id} state={state}")
                    return True  # 进程已结束，也算确认
            
            time.sleep(2)
        
        logging.warning(f"⏰ Timeout waiting for process: {task.uni_id}")
        return False
    
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
    
    def check_and_handle_finished_tasks(self):
        """检查已完成/异常的任务并处理重试
        
        通过 JSON 文件检测进程状态变化
        """
        for task in self.tasks:
            if task.status != "running" and task.status != "completed":
                continue
            
            record = self.process_json.get_record(task.uni_id)
            if not record:
                continue
            
            state = record.get('state', '')
            
            if state == 'normal_exit':
                # 正常退出
                if task.status != "completed":
                    task.status = "completed"
                    logging.info(f"✅ Task {task.uni_id} (Queue {task.queue_id}) completed successfully")
            
            elif state == 'abnormal_exit':
                # 异常退出，需要重试
                if task.status == "running":
                    error_type = record.get('error_type', 'unknown')
                    handle_task_retry(task, error_type, retry_config)
    
    def _sort_candidate_tasks(self, tasks: List[Task]) -> List[Task]:
        """对候选任务进行排序
        
        排序规则：
        1. 优先GPU需求量大的任务
        2. 其次优先队列ID小的任务
        """
        return sorted(tasks, key=lambda t: (-t.gpu_count, t.queue_id))
    
    def run(self):
        """主调度循环（多GPU版本）
        
        核心逻辑：
        1. 检查已完成/异常的任务，处理重试
        2. 获取所有空闲队列的头部任务
        3. 按优先级排序（GPU需求量大优先，队列ID小优先）
        4. 逐个分配任务到可用 GPU
        5. 每分配一个任务后等待确认，再分配下一个
        """
        logging.info("🏁 Starting Multi-GPU competition scheduler")
        self.print_status()
        
        try:
            while self.running:
                # 检查已完成/异常的任务
                self.check_and_handle_finished_tasks()
                
                # 检查是否所有任务都完成
                incomplete_tasks = [t for t in self.tasks if t.status != "completed"]
                if not incomplete_tasks:
                    logging.info("🎉 All tasks completed!")
                    break
                
                # 获取当前忙碌的队列
                busy_queues = self.get_busy_queues()
                
                # 获取空闲队列的头部任务（考虑退避）
                candidate_tasks = []
                for qid in self.queues.keys():
                    if qid not in busy_queues:
                        head_task = self.get_queue_head_task(qid)
                        if head_task and is_task_ready(head_task):
                            candidate_tasks.append(head_task)
                
                if not candidate_tasks:
                    # 没有可调度的任务，等待
                    time.sleep(check_time)
                    continue
                
                # 按优先级排序：GPU需求量大优先，队列ID小优先
                candidate_tasks = self._sort_candidate_tasks(candidate_tasks)
                logging.info(f"📋 Candidate tasks (sorted): {[(t.queue_id, t.gpu_count) for t in candidate_tasks]}")
                
                # 获取当前被占用的 GPU
                occupied_gpus = self.get_occupied_gpus()
                
                # 逐个分配任务
                tasks_started = 0
                for task in candidate_tasks:
                    # 重新获取占用的 GPU（实时检测）
                    occupied_gpus = self.get_occupied_gpus()
                    
                    # 查找足够数量的可用 GPU
                    gpu_ids = self.find_available_gpus(task.gpu_count, task.estimated_memory_gb, occupied_gpus)
                    
                    if gpu_ids is None:
                        logging.info(f"⏳ Not enough GPUs for task {task.uni_id} (need {task.gpu_count} GPUs, {task.estimated_memory_gb}GB each)")
                        continue
                    
                    # 执行任务
                    success = self.execute_task(task, gpu_ids)
                    
                    if success:
                        tasks_started += 1
                        
                        # 等待进程确认启动
                        self.wait_for_process_start(task, timeout=60)
                        
                        # 等待一段时间再分配下一个任务
                        logging.info(f"⏳ Waiting {self.task_start_delay}s before next task...")
                        time.sleep(self.task_start_delay)
                
                if tasks_started > 0:
                    logging.info(f"📈 Started {tasks_started} task(s) this round")
                
                # 打印状态
                self.print_status()
                
                # 等待下一轮调度
                time.sleep(check_time)
                
        except KeyboardInterrupt:
            logging.info("🛑 Interrupted by user")
            self.running = False
        
        logging.info("🏁 Scheduler stopped")


# =============================================================================
# 主入口
# =============================================================================

if __name__ == "__main__":
    competitor = MultiGPUCompetitor()
    competitor.run()
