# 竞争GPU管理逻辑

## 概述

为了有效管理多个脚本对GPU资源的竞争使用，我们实现了一个基于线程池的进程管理系统。该系统支持两种调度模式：
- **单GPU模式**（`main_gpu.py`）：每个任务使用单张GPU
- **多GPU模式**（`main_gpus.py`）：每个任务可以使用多张GPU

### 核心特性

- **队内串行**：同一队列的任务严格按顺序执行，前一个任务完成后才能启动下一个
- **队间并行**：不同队列的任务可以同时在不同 GPU 上执行
- **重试机制**：任务失败后根据配置进行重试和退避
- **智能GPU选择**：多个可用GPU时使用高频采样策略选择最优GPU

## 代码结构

```
scripts/compete_gpu_retry/
├── app/                       # 应用程序目录
│   ├── main_gpu.py            # 单GPU调度器
│   ├── main_gpus.py           # 多GPU调度器
│   └── utils/                 # 工具模块
│       ├── __init__.py
│       ├── gpu_monitor.py     # GPU 状态监控
│       ├── gpu_select.py      # GPU 智能选择策略
│       ├── parse_command_file.py  # 单GPU命令文件解析器
│       ├── gpus_command_file.py   # 多GPU命令文件解析器
│       ├── process_yaml.py    # YAML 配置文件管理
│       └── retry.py           # 重试机制配置
├── config/                    # 配置文件目录
│   └── gpu_manage.yaml        # 调度器配置文件
├── command/                   # 命令文件目录
│   ├── command_gpu.txt        # 单GPU任务配置文件
│   └── command_gpus.txt       # 多GPU任务配置文件
├── logs/                      # 日志目录
│   ├── compete_gpu*.log       # 单GPU调度器日志
│   └── compete_gpus*.log      # 多GPU调度器日志
└── help/                      # 帮助文档
    └── GPU管理后端逻辑.md
```

### 模块说明

| 模块 | 功能 |
|------|------|
| `gpu_monitor.py` | GPU 显存检测、用户进程检测、GPU 列表探测 |
| `gpu_select.py` | GPU 智能选择策略，支持节省显存和防止溢出两种模式 |
| `process_yaml.py` | YAML 配置文件管理，支持嵌套键访问、命令行参数解析、路径处理 |
| `retry.py` | 重试配置类 `RetryConfig` |
| `parse_command_file.py` | 单GPU命令文件解析器 |
| `gpus_command_file.py` | 多GPU命令文件解析器 |
| `main_gpu.py` | 单GPU调度器（使用线程池实现队间并行） |
| `main_gpus.py` | 多GPU调度器（使用线程池实现队间并行） |

### 路径配置

所有路径都相对于脚本位置，便于部署：

**单GPU模式**：
- `log_dir`: `./logs`
- `commands_path`: `./command/command_gpu.txt`

**多GPU模式**：
- `log_dir`: `./logs`
- `commands_path`: `./command/command_gpus.txt`

**通用配置**：
- `work_dir`: 工作目录，用于命令中 `{work_dir}` 变量替换
- `config_path`: `./config/gpu_manage.yaml`

### 配置管理

使用 YAML 文件管理所有配置参数，便于修改和维护：

#### gpu_manage.yaml 格式

```yaml
# 调度配置
check_time: 5  # 调度间隔（秒）
maximize_resource_utilization: false  # 极限利用资源模式
memory_save_mode: true  # GPU选择模式：true=节省显存，false=防止溢出
# 在节省显存模式（true）下：显存利用率*剩余显存 越小，优先级越高
# 在防止显存溢出模式（false）下：显存利用率*当前占用显存 越小，优先级越高

# GPU 配置
compete_gpus: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]  # 手动指定的 GPU 列表
use_all_gpus: true  # 是否自动探测所有 GPU
gpu_left: 1  # 剩余几张卡给其他用户
min_gpu: 3  # 用户至少用几张卡
max_gpu: 6  # 用户最多用几张卡
# 实际用的卡是 min(max_gpu, max(min_gpu, available_gpus-gpu_left))

# 重试配置
retry_config:
  max_retry_before_backoff: 3  # 每 3 次重试后进入退避
  backoff_duration: 600         # 退避时间 10 分钟

# 工作目录配置
# 支持以下格式：
# - null: 自动设置为脚本父目录（默认）
# - "../": 相对于脚本的父目录
# - "/absolute/path": 绝对路径
# - "relative/path": 相对于脚本的路径
work_dir: null  # 默认：脚本父目录

# 命令文件配置
gpu_command_file: "command/command_gpu.txt"   # 单GPU配置文件
gpus_command_file: "command/command_gpus.txt" # 多GPU配置文件
```

#### GPU 配置详解

**1. GPU 竞争范围配置**：
- `compete_gpus`: 手动指定的 GPU 列表
- `use_all_gpus`: 是否自动探测所有可用 GPU

**2. GPU 预留配置**：
- `gpu_left`: 预留给其他用户的 GPU 数量
- `min_gpu`: 用户至少使用的 GPU 数量
- `max_gpu`: 用户最多使用的 GPU 数量

**3. GPU 分配公式**：
```
实际使用GPU数量 = min(max_gpu, max(min_gpu, available_gpus - gpu_left))
```

其中：
- `available_gpus`: 当前可用的 GPU 总数
- `gpu_left`: 预留给其他用户的 GPU 数量
- `min_gpu`: 用户至少需要的 GPU 数量
- `max_gpu`: 用户最多需要的 GPU 数量

**4. 分配示例**：
```yaml
# 示例1：10张卡，预留1张，至少用3张，最多用3张
# total=10, gpu_left=1, min_gpu=3, max_gpu=3
# available_after_reservation = 10-1 = 9
# min_required = max(3, 9) = 9
# target_count = min(3, 9) = 3
# 使用GPU: [0,1,2] (3张)
# 预留GPU: [3,4,5,6,7,8,9] (7张)

# 示例2：4张卡，预留1张，至少用3张，最多用3张
# total=4, gpu_left=1, min_gpu=3, max_gpu=3
# available_after_reservation = 4-1 = 3
# min_required = max(3, 3) = 3
# target_count = min(3, 3) = 3
# 使用GPU: [0,1,2] (3张)
# 预留GPU: [3] (1张)

# 示例3：3张卡，预留2张，至少用3张，最多用3张
# total=3, gpu_left=2, min_gpu=3, max_gpu=3
# available_after_reservation = 3-2 = 1
# min_required = max(3, 1) = 3
# target_count = min(3, 3) = 3
# 使用GPU: [0,1,2] (3张)
# 预留GPU: [] (0张，无法满足预留要求)

# 示例4：10张卡，预留1张，至少用2张，最多用5张
# total=10, gpu_left=1, min_gpu=2, max_gpu=5
# available_after_reservation = 10-1 = 9
# min_required = max(2, 9) = 9
# target_count = min(5, 9) = 5
# 使用GPU: [0,1,2,3,4] (5张)
# 预留GPU: [5,6,7,8,9] (5张)
```

#### 工作目录配置详解

工作目录 `work_dir` 支持多种配置方式：

1. **默认配置（null）**：
   ```yaml
   work_dir: null
   ```
   自动设置为脚本父目录

2. **相对路径**：
   ```yaml
   work_dir: "../"        # 脚本父目录
   work_dir: "../../"     # 脚本祖父目录
   work_dir: "work"       # 脚本同级的 work 目录
   ```
   相对于脚本位置解析

3. **绝对路径**：
   ```yaml
   work_dir: "/home/user/project"
   work_dir: "/tmp/workspace"
   ```
   直接使用绝对路径

#### GPU 智能选择策略（gpu_select.py）

当有多个可用GPU时，系统会使用智能选择策略来选择最优GPU。

**选择模式**：

1. **节省显存模式**（`memory_save_mode: true`）：
   - 优先选择 `显存利用率 × 剩余显存` 最小的GPU
   - 如果相等，选择剩余显存最小的GPU
   - 适用场景：希望尽量使用已经在使用的GPU，节省空闲GPU资源

2. **防止显存溢出模式**（`memory_save_mode: false`）：
   - 优先选择 `显存利用率 × 当前占用显存` 最小的GPU
   - 如果相等，选择当前占用显存最小的GPU
   - 适用场景：希望避免在高负载GPU上运行任务，防止OOM

**高频采样机制**：
- 在分配GPU时，系统会在3秒内进行30次采样（每0.1秒一次）
- 取所有采样的平均值来计算优先级分数
- 这样可以获得更稳定的GPU状态评估，避免瞬时波动影响选择

**选择流程**：
1. 筛选满足显存需求的候选GPU
2. 如果只有一个候选GPU，直接返回
3. 如果有多个候选GPU，启动高频采样
4. 根据选择模式计算每个GPU的优先级分数
5. 选择分数最小（优先级最高）的GPU

**使用示例**：
```python
from utils.gpu_select import select_gpu, select_gpus

# 选择单个最优GPU
best_gpu = select_gpu(
    gpu_ids=[0, 1, 2, 3],
    memory_save_mode=True,
    required_memory=20  # GB
)

# 选择多个最优GPU
best_gpus = select_gpus(
    gpu_ids=[0, 1, 2, 3, 4, 5],
    count=3,
    memory_save_mode=True,
    required_memory=20  # GB
)
```

#### process_yaml.py 模块

负责加载和管理 YAML 配置文件，提供统一的配置处理接口：

**主要功能**：
- 安全加载 YAML 文件
- 支持嵌套键访问（如 `retry_config.max_retry_before_backoff`）
- 提供默认值支持
- 内存中配置更新
- **命令行参数解析**：统一处理 `--command-file` 和 `--config-file` 参数
- **路径处理**：自动解析相对路径和绝对路径
- **工作目录解析**：支持多种工作目录配置方式

**核心函数**：
```python
from utils.process_yaml import ProcessYAML, load_config_with_args, parse_command_file_path, resolve_work_dir

# 解析配置文件路径
config_path = parse_config_file_path(args, script_dir, "config/gpu_manage.yaml")

# 解析命令文件路径
commands_path = parse_command_file_path(args, script_dir, "command.txt")

# 加载配置（统一接口）
config_processor, config = load_config_with_args(args, script_dir)

# 解析工作目录
work_dir = resolve_work_dir(config, script_dir)
```

**使用方式**：
```python
# 基本用法
config = ProcessYAML('config/gpu_manage.yaml')
check_time = config.get('check_time', 5)
retry_count = config.get('retry_config.max_retry_before_backoff', 3)

# 命令行参数支持（推荐）
config_processor, config = load_config_with_args(args, SCRIPT_DIR)
work_dir = resolve_work_dir(config, SCRIPT_DIR)
commands_path = parse_command_file_path(args, SCRIPT_DIR, 'command.txt')
```

## 代码核心逻辑

### 单GPU模式（main_gpu.py）

核心逻辑：**队列内串行，队列间并行，随机调度**执行进程。

- **队列内串行**：同一队列的任务严格按顺序执行，前一个任务完成后才能启动下一个
- **队列间并行**：不同队列的任务可以同时在不同 GPU 上执行
- **随机调度**：空闲队列的头部任务随机打乱顺序进行公平调度
- **重试机制**：进程发生异常后要进行重试，重试超上限（3次）后退避一段时间（10分钟）再进行下一次重试
- **GPU 预留**：根据配置预留指定数量的 GPU 给其他用户使用

整体流程：**任务配置 → 队列分组 → GPU 动态分配 → 空闲队列头任务随机调度 → 逐个分配 GPU → 等待进程确认 → 状态监控**。

### 多GPU模式（main_gpus.py）

核心逻辑：**队列内串行，队列间并行，优先大任务**执行进程。

- **队列内串行**：同一队列的任务严格按顺序执行
- **队列间并行**：不同队列的任务可以同时在不同 GPU 上执行
- **优先大任务**：优先调度GPU需求量大的任务
- **其次优先小队列**：GPU需求量相同时，优先调度队列ID小的任务
- **多GPU分配**：每个任务可以使用多张GPU，通过 `CUDA_VISIBLE_DEVICES=0,1,2` 设置
- **重试机制**：与单GPU模式相同

整体流程：**任务配置 → 队列分组 → GPU 动态分配 → 空闲队列头任务优先级排序 → 逐个分配多GPU → 等待进程确认 → 状态监控**。

#### 多GPU调度优先级

```python
# 排序规则：GPU需求量大优先，队列ID小优先
sorted_tasks = sorted(tasks, key=lambda t: (-t.gpu_count, t.queue_id))
```

**示例**：
```
候选任务：
  - 队列1，需要1张GPU
  - 队列2，需要3张GPU
  - 队列3，需要2张GPU

排序后：
  1. 队列2（3张GPU）  ← 优先调度
  2. 队列3（2张GPU）
  3. 队列1（1张GPU）
```

### 1. 任务与队列

1. 所有待执行任务从命令配置文件中读取。
2. 启动时脚本解析命令文件，构造成 `Task` 对象。
3. 根据队列 ID 将任务分组，使用线程池实现队间并行。

#### 单GPU命令文件格式（command/command_gpu.txt）

```
# 任务配置文件格式说明：
# 1. 每个任务块以空行分隔
# 2. 第一行：队列ID（数字，可跟注释如 1 #队列ID）
# 3. 中间行：命令列表（支持变量 {work_dir}）
# 4. 最后一行：显存需求（数字，可跟注释如 20 #显存）

# 任务1：队列1
1 #队列ID
rm -rf {work_dir}/experiments/car196/knowledge_base
bash {work_dir}/scripts/run_pipeline.sh car
20 #显存需求

# 任务2：队列2
2
bash {work_dir}/scripts/run_pipeline.sh flower
20
```

**返回格式**：`List[(commands, queue_id, memory_gb)]`

#### 多GPU命令文件格式（command/command_gpus.txt）

```
# 任务配置文件格式说明：
# 1. 每个任务块以空行分隔
# 2. 第一行：队列ID（数字，可跟注释如 1 #队列ID）
# 3. 中间行：命令列表（支持变量 {work_dir}）
# 4. 倒数第二行：GPU数量需求（数字，可跟注释如 1 #GPU数量需求）
# 5. 最后一行：显存需求（数字，可跟注释如 20 #显存）

# 任务1：队列1，需要1张GPU
1 #队列ID
bash {work_dir}/scripts/run_pipeline.sh car
1 #GPU数量需求
20 #显存需求

# 任务2：队列2，需要3张GPU
2
bash {work_dir}/scripts/run_pipeline.sh flower
3 #GPU数量需求
20
```

**返回格式**：`List[(commands, queue_id, gpu_count, memory_gb)]`

**支持的变量**：
- `{work_dir}` - 工作目录

**格式特点**：
- 队列ID在第一行
- 命令行在中间，**不需要引号**
- 多GPU模式需要额外指定GPU数量需求
- 显存需求在最后一行
- 数字后可以跟注释（如 `1 #队列ID`）

#### 命令文件解析器

**单GPU解析器**（`parse_command_file.py`）：
```python
from app.utils.parse_command_file import parse_command_file

tasks = parse_command_file('command/command_gpu.txt')
# 返回: List[(commands, queue_id, memory_gb)]
```

**多GPU解析器**（`gpus_command_file.py`）：
```python
from app.utils.gpus_command_file import parse_command_file

tasks = parse_command_file('command/command_gpus.txt')
# 返回: List[(commands, queue_id, gpu_count, memory_gb)]
```

4. 任务分组规则：
   - **同一队列内**：严格按顺序执行（队列内串行）
   - **不同队列之间**：可同时调度（队列间并行）

### 2. GPU 分配与进程管理

5. **GPU 竞争范围配置**：
   - `use_all_gpus=True`：自动探测所有可用 GPU
   - `use_all_gpus=False`：使用 `compete_gpus` 指定的 GPU 列表

6. **GPU 动态分配**：
   - 计算可用 GPU 数量：`min(max_gpu, max(min_gpu, available_gpus - gpu_left))`
   - 确保不超过实际可用的 GPU 数量
   - 从前面取目标数量的 GPU（编号较小的优先使用）
   - 记录预留和使用的 GPU 信息

7. **GPU 可用性检查**（`find_available_gpu` / `find_available_gpus`）：
   - **内部占用检查**（非极限模式）：检查调度器内部是否有其他任务正在使用该GPU
   - **显存检查**：确保有足够的可用显存（`required_memory`）
   - **外部进程检查**（非极限模式）：确保当前用户没有其他 Python 进程在该 GPU 上
   - **智能选择**：多个候选GPU时使用高频采样策略选择最优GPU

8. **GPU 占用追踪机制**：
   - 调度器内部维护 `occupied_gpus` 字典，记录每个GPU被哪个队列占用
   - `_wait_for_gpu` / `_wait_for_gpus`：获取GPU时立即标记为占用（`🔒 acquired`）
   - `_release_gpu` / `_release_gpus`：任务完成后释放GPU（`🔓 released`）
   - 这确保了队间并行时不同队列分配到不同GPU，避免依赖 `nvidia-smi` 检测延迟

9. **任务执行**（`execute_task`）：
   - 设置 `CUDA_VISIBLE_DEVICES={gpu_id}` 环境变量
   - 串行执行任务的所有命令
   - 通过命令返回码判断成功/失败
   - 失败时触发重试机制

### 3. 重试机制

10. **重试触发条件**：
    - 命令返回非零退出码
    - 命令执行超时（默认2小时）
    - 命令执行异常

11. **重试处理流程**（`_handle_task_failure`）：
    - 增加 `retry_count`
    - 记录错误类型
    - 检查是否需要退避
    - 将任务状态重置为 "pending"

12. **退避策略**：
    - 每 N 次重试后进入退避期（默认 N=3）
    - 退避时间可配置（默认 10 分钟）
    - 退避期间任务不会被调度

### 4. 队列调度与状态监控

13. **线程池调度**（`run` 主方法）：
    - 使用 `ThreadPoolExecutor` 实现队间并行
    - 每个队列一个线程，独立执行队列内任务
    - 队列内任务严格串行执行

14. **队列执行**（`_run_queue`）：
    - 遍历队列中的所有任务
    - 每个任务执行前等待可用GPU
    - 任务失败时根据重试机制处理
    - 任务成功后继续下一个任务

15. **状态监控**（`print_state`）：
    - 显示各队列的忙碌/空闲状态
    - 统计 pending/running/completed/failed 任务数量

## 重试机制详解

### 重试触发条件

1. **命令执行失败**：
   - 命令返回非零退出码
   - 命令执行超时（默认2小时）
   - 命令执行过程中抛出异常

2. **重试处理流程**（`_handle_task_failure`）：
   - 增加 `retry_count`
   - 记录 `error_type`
   - 检查是否需要退避（每 N 次重试后）
   - 将任务状态重置为 "pending"

3. **退避策略**：
   - 每 N 次重试后进入退避期（默认 N=3）
   - 退避时间可配置（默认 10 分钟）
   - 退避期间任务等待，不占用GPU资源

### 重试配置

在 `config/gpu_manage.yaml` 中配置：

```yaml
retry_config:
  max_retry_before_backoff: 3  # 每 3 次重试后进入退避
  backoff_duration: 600        # 退避时间 10 分钟（600秒）
```

代码中使用：

```python
from app.utils.retry import RetryConfig

retry_config = RetryConfig(
    max_retry_before_backoff=3,  # 每 3 次重试后进入退避
    backoff_duration=600         # 退避时间 10 分钟
)
```

## 使用示例

### 1. 配置调度器

编辑 `config/gpu_manage.yaml` 文件调整参数：
```yaml
# 调度配置
check_time: 3  # 调度间隔（秒）

# GPU 配置
compete_gpus: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
use_all_gpus: true   # 自动探测所有GPU
gpu_left: 2          # 预留 2 张 GPU 给其他用户
min_gpu: 2           # 至少使用 2 张 GPU
max_gpu: 3           # 最多使用 3 张 GPU

# 重试配置
retry_config:
  max_retry_before_backoff: 3  # 每 3 次重试后进入退避
  backoff_duration: 600        # 退避时间 10 分钟

# 工作目录
work_dir: "/home/hdl/project/fgvr_test_new"
```

### 2. 创建任务配置

**单GPU任务配置**（command/command_gpu.txt）：
```
# 汽车数据集任务
1 #队列1
bash {work_dir}/scripts/run_pipeline.sh car
20 #显存需求

# 花卉数据集任务
2 #队列2
bash {work_dir}/scripts/run_pipeline.sh flower
20 #显存需求
```

**多GPU任务配置**（command/command_gpus.txt）：
```
# 汽车数据集任务（1张GPU）
1 #队列1
bash {work_dir}/scripts/run_pipeline.sh car
1 #GPU数量需求
20 #显存需求

# 花卉数据集任务（2张GPU）
2 #队列2
bash {work_dir}/scripts/run_pipeline.sh flower
2 #GPU数量需求
20 #显存需求
```

### 3. 启动调度器

**单GPU模式**：
```bash
cd /home/hdl/project/fgvr_test_new/scripts/compete_gpu_retry

# 使用默认配置
nohup python app/main_gpu.py > /dev/null 2>&1 &

# 使用自定义命令文件
nohup python app/main_gpu.py --command-file /path/to/custom_command.txt > /dev/null 2>&1 &

# 使用自定义配置文件
nohup python app/main_gpu.py --config-file /path/to/custom_gpu_manage.yaml > /dev/null 2>&1 &

# 同时指定自定义命令文件和配置文件
nohup python app/main_gpu.py --command-file custom.txt --config-file custom_gpu_manage.yaml > /dev/null 2>&1 &
```

**多GPU模式**：
```bash
cd /home/hdl/project/fgvr_test_new/scripts/compete_gpu_retry

# 使用默认配置
nohup python app/main_gpus.py > /dev/null 2>&1 &

# 使用自定义命令文件
nohup python app/main_gpus.py --command-file /path/to/custom_command_gpus.txt > /dev/null 2>&1 &

# 使用自定义配置文件
nohup python app/main_gpus.py --config-file /path/to/custom_gpu_manage.yaml > /dev/null 2>&1 &
```

**命令行参数说明**：
- `--command-file`: 指定命令配置文件路径（支持相对路径和绝对路径）
- `--config-file`: 指定YAML配置文件路径（支持相对路径和绝对路径）
- 默认值：单GPU模式使用 `command/command_gpu.txt` 和 `config/gpu_manage.yaml`
- 默认值：多GPU模式使用 `command/command_gpus.txt` 和 `config/gpu_manage.yaml`

### 4. 查看日志

**单GPU模式**：
```bash
tail -f logs/compete_gpu.log
```

**多GPU模式**：
```bash
tail -f logs/compete_gpus.log
```

### 5. 查看进程状态

**单GPU模式**：
```bash
cat logs/uni_id.json | python -m json.tool
```

**多GPU模式**：
```bash
cat logs/uni_id_gpus.json | python -m json.tool
```

### 6. 修改任务配置

**单GPU模式**：编辑 `command/command_gpu.txt` 文件
**多GPU模式**：编辑 `command/command_gpus.txt` 文件

## 注意事项

1. **路径独立性**：所有路径相对于脚本位置，便于部署到不同环境
2. **配置管理**：通过 `gpu_manage.yaml` 统一管理配置，避免修改代码
3. **工作目录**：支持相对路径和绝对路径配置，用于命令中 `{work_dir}` 变量替换
4. **GPU 配置**：合理设置 `gpu_left`、`min_gpu` 和 `max_gpu` 参数
   - `gpu_left` 确保其他用户有足够的 GPU 资源
   - `min_gpu` 确保当前用户有足够的 GPU 进行任务调度
   - `max_gpu` 限制最大使用的 GPU 数量
5. **命令格式**：
   - 命令**不需要引号**包围
   - 单GPU模式：队列ID → 命令 → 显存需求
   - 多GPU模式：队列ID → 命令 → GPU数量 → 显存需求
6. **队列设计**：
   - 同一队列内的任务串行执行
   - 不同队列的任务并行执行
   - 合理设计队列数量和任务分配
7. **日志管理**：日志文件自动编号，避免覆盖
8. **GPU 资源**：确保任务预估的显存需求准确，避免 OOM 错误
9. **重试机制**：任务失败后自动重试，每 N 次重试后进入退避期
10. **YAML 语法**：编辑配置文件时注意 YAML 语法，特别是缩进
11. **模式选择**：根据任务需求选择单GPU或多GPU模式

## 功能验证测试

### 测试脚本

使用 `test_gpu_memory.py` 进行功能验证：
- 消耗约500MB显存
- 运行约60秒
- 支持命令行参数：`python test_gpu_memory.py [duration_seconds] [memory_mb]`

### 测试结果（2025-12-03）

测试配置：3个队列，5个任务（队列1: 2任务，队列2: 2任务，队列3: 1任务）

**验证通过的功能**：

1. **队间并行** ✅
   - Queue 1、2、3 同时启动
   - 不同队列分配到不同GPU（Queue 1 → GPU 1，Queue 2 → GPU 2）

2. **队内串行** ✅
   - Queue 1 的任务1完成后才开始任务2
   - Queue 2 的任务1完成后才开始任务2

3. **GPU占用追踪** ✅
   - `🔒 GPU acquired` 和 `🔓 GPU released` 正确配对
   - 非极限模式下，不同队列不会分配到同一GPU

4. **外部进程检测** ✅
   - GPU 0 有外部进程，被正确排除

**日志示例**：
```
🔒 GPU 1 acquired by queue 1
🎯 Queue 1: Executing task 1/2 on GPU 1
🔒 GPU 2 acquired by queue 2
🎯 Queue 2: Executing task 1/2 on GPU 2
✅ Task (Queue 1) completed successfully
🔓 GPU 1 released by queue 1
🔒 GPU 1 acquired by queue 1
🎯 Queue 1: Executing task 2/2 on GPU 1
...
🎉 All queues finished!
```
