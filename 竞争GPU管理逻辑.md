# 竞争GPU管理逻辑

## 概述

为了有效管理多个脚本对GPU资源的竞争使用，我们实现了一个基于唯一标识符（uni_id）的进程管理系统。该系统支持两种调度模式：
- **单GPU模式**（`main_gpu.py`）：每个任务使用单张GPU
- **多GPU模式**（`main_gpus.py`）：每个任务可以使用多张GPU

## 代码结构（模块化版本）

```
scripts/compete_gpu_retry/
├── main_gpu.py                # 单GPU调度器
├── main_gpus.py               # 多GPU调度器
├── config.yaml                # 调度器配置文件
├── command_gpu.txt            # 单GPU任务配置文件
├── command_gpus.txt           # 多GPU任务配置文件
├── logs/                      # 日志目录（相对于脚本）
│   ├── compete_gpu*.log       # 单GPU调度器日志
│   ├── compete_gpus*.log      # 多GPU调度器日志
│   ├── uni_id.json            # 单GPU进程状态记录
│   └── uni_id_gpus.json       # 多GPU进程状态记录
└── utils/
    ├── __init__.py
    ├── gpu_monitor.py         # GPU 状态监控
    ├── gpu_select.py          # GPU 智能选择策略
    ├── process_json.py        # JSON 文件管理
    ├── process_yaml.py        # YAML 配置文件管理
    ├── retry.py               # 重试机制
    ├── gpu_command_file.py    # 单GPU命令文件解析器
    └── gpus_command_file.py   # 多GPU命令文件解析器
```

### 模块说明

| 模块 | 功能 |
|------|------|
| `gpu_monitor.py` | GPU 显存检测、用户进程检测、GPU 列表探测 |
| `gpu_select.py` | GPU 智能选择策略，支持节省显存和防止溢出两种模式 |
| `process_json.py` | uni_id.json 文件的读写、进程状态管理 |
| `process_yaml.py` | YAML 配置文件管理，支持嵌套键访问 |
| `retry.py` | 重试配置、退避策略、任务状态检查 |
| `gpu_command_file.py` | 单GPU命令文件解析器 |
| `gpus_command_file.py` | 多GPU命令文件解析器 |
| `config.yaml` | 调度器配置文件，包含所有运行参数 |
| `command_gpu.txt` | 单GPU任务配置文件 |
| `command_gpus.txt` | 多GPU任务配置文件 |

### 路径配置

所有路径都相对于脚本位置，便于部署：

**单GPU模式**：
- `log_dir`: `./logs`
- `process_json_path`: `./logs/uni_id.json`
- `commands_path`: `./command_gpu.txt`

**多GPU模式**：
- `log_dir`: `./logs`
- `process_json_path`: `./logs/uni_id_gpus.json`
- `commands_path`: `./command_gpus.txt`

**通用配置**：
- `work_dir`: 脚本父目录，用于命令执行
- `config_path`: `./config.yaml`，YAML 配置文件

### 配置管理

使用 YAML 文件管理所有配置参数，便于修改和维护：

#### config.yaml 格式

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
max_gpu: 3  # 用户最多用几张卡
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
gpu_command_file: "command_gpu.txt"   # 单GPU配置文件
gpus_command_file: "command_gpus.txt" # 多GPU配置文件
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

负责加载和管理 YAML 配置文件：

**主要功能**：
- 安全加载 YAML 文件
- 支持嵌套键访问（如 `retry_config.max_retry_before_backoff`）
- 提供默认值支持
- 内存中配置更新

**使用方式**：
```python
from utils import ProcessYAML

# 加载配置
config = ProcessYAML('config.yaml')

# 获取配置项
check_time = config.get('check_time', 5)
retry_count = config.get('retry_config.max_retry_before_backoff', 3)

# 更新配置（内存中）
config.update('new_key', 'new_value')
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
2. 启动时脚本为每个任务生成唯一的 `uni_id`，并构造成 `Task` 对象，**暂不绑定具体 GPU**。

#### 单GPU命令文件格式（command_gpu.txt）

```
# 任务配置文件格式说明：
# 1. 每个任务块以空行分隔
# 2. 第一行：队列ID（数字，可跟注释如 "1 #队列ID"）
# 3. 中间行：命令列表（建议用引号包围）
# 4. 最后一行：显存需求（数字，可跟注释如 "20 #显存"）

# 任务1：队列1
1 #队列ID
"rm -rf {work_dir}/experiments/car196/knowledge_base"
"bash {work_dir}/scripts/set_hyperparameters.sh --experience_number 8"
"bash {work_dir}/scripts/run_pipeline.sh car --uni_id {uni_id}"
20 #显存需求

# 任务2：队列2
2
"rm -rf {work_dir}/experiments/flower102/knowledge_base"
"bash {work_dir}/scripts/set_hyperparameters.sh --experience_number 5"
"bash {work_dir}/scripts/run_pipeline.sh flower --uni_id {uni_id}"
20
```

**返回格式**：`List[(commands, queue_id, memory_gb)]`

#### 多GPU命令文件格式（command_gpus.txt）

```
# 任务配置文件格式说明：
# 1. 每个任务块以空行分隔
# 2. 第一行：队列ID（数字，可跟注释如 "1 #队列ID"）
# 3. 中间行：命令列表（建议用引号包围）
# 4. 倒数第二行：GPU数量需求（数字，可跟注释如 "3 #GPU数量"）
# 5. 最后一行：显存需求（数字，可跟注释如 "20 #显存"）

# 任务1：队列1，需要1张GPU
1 #队列ID
"rm -rf {work_dir}/experiments/car196/knowledge_base"
"bash {work_dir}/scripts/set_hyperparameters.sh --experience_number 8"
"bash {work_dir}/scripts/run_pipeline.sh car --uni_id {uni_id}"
1 #GPU数量需求
20 #显存需求

# 任务2：队列2，需要3张GPU
2
"rm -rf {work_dir}/experiments/flower102/knowledge_base"
"bash {work_dir}/scripts/set_hyperparameters.sh --experience_number 15"
"bash {work_dir}/scripts/run_pipeline.sh flower --uni_id {uni_id}"
3 #GPU数量需求
20
```

**返回格式**：`List[(commands, queue_id, gpu_count, memory_gb)]`

**支持的变量**：
- `{work_dir}` - 工作目录（脚本父目录）
- `{uni_id}` - 唯一标识符（自动生成）

**格式特点**：
- 队列ID在第一行
- 命令行在中间，可以用引号包围
- 多GPU模式需要额外指定GPU数量需求
- 显存需求在最后一行
- 数字后可以跟注释（如 `1 #队列ID`）
- 解析器会自动读取第一个数字作为值

#### 命令文件解析器

**单GPU解析器**（`gpu_command_file.py`）：
```python
from utils.gpu_command_file import parse_command_file

tasks = parse_command_file('command_gpu.txt')
# 返回: List[(commands, queue_id, memory_gb)]
```

**多GPU解析器**（`gpus_command_file.py`）：
```python
from utils.gpus_command_file import parse_command_file

tasks = parse_command_file('command_gpus.txt')
# 返回: List[(commands, queue_id, gpu_count, memory_gb)]
```

3. 根据队列 ID 将任务分组：
   - **同一队列内**：严格按顺序执行（队列内串行）
   - **不同队列之间**：可同时调度（队列间并行）

### 2. GPU 分配与进程管理

4. **GPU 竞争范围配置**：
   - `use_all_gpus=True`：自动探测所有可用 GPU
   - `use_all_gpus=False`：使用 `compete_gpus` 指定的 GPU 列表

5. **GPU 动态分配**：
   - 计算可用 GPU 数量：`max(min_gpu, available_gpus - gpu_left)`
   - 确保不超过实际可用的 GPU 数量
   - 从前面取目标数量的 GPU（编号较小的优先使用）
   - 记录预留和使用的 GPU 信息

6. **GPU 可用性检查**（`find_available_gpu`）：
   - **显存检查**：确保有足够的可用显存（`required_memory`）
   - **用户进程检查**（非极限模式）：确保当前用户没有其他 Python 进程在该 GPU 上

7. **任务执行**（`execute_task`）：
   - 设置 `CUDA_VISIBLE_DEVICES={gpu_id}` 环境变量
   - 串行执行任务的所有命令
   - 更新任务状态为 "running"
   - 记录 PID 到 `uni_id.json`

8. **进程启动确认**（`wait_for_process_start`）：
   - 等待最多 60 秒，直到 JSON 中出现有效的 PID
   - 通过 `psutil.pid_exists(pid)` 确认进程真实存在

### 3. 进程状态与重试机制

9. **进程状态跟踪**（`uni_id.json`）：
   - 外部脚本（如 `run_pipeline.sh`）启动后会写入：
     ```json
     {
       "uni_id": {
         "pid": 12345,
         "state": "running",
         "retry_count": 0
       }
     }
     ```
   - 进程正常退出时，外部脚本更新为 `state: "normal_exit"`
   - 进程异常退出时，外部脚本更新为 `state: "abnormal_exit"` 和 `error_type`

10. **重试机制**（`check_and_handle_finished_tasks`）：
    - 检测到 `abnormal_exit` 状态时：
      - 将任务状态重置为 "pending"
      - 增加 `retry_count`
      - 根据重试次数决定是否需要退避
      - 生成新的 `uni_id` 用于重试
    - 退避策略：每 3 次重试后退避 10 分钟

### 4. 队列推进与状态监控

11. **忙碌队列检测**（`get_busy_queues`）：
    - 通过 JSON 中 `state=running` 且进程确实存在的记录
    - 返回当前正在执行任务的队列 ID 集合

12. **任务调度**（`run` 主循环）：
    - 获取所有空闲队列的头部任务
    - 随机打乱顺序（公平调度）
    - 逐个分配到可用 GPU
    - 每分配一个任务后等待 30 秒再分配下一个

13. **状态监控**（`print_status`）：
    - 显示各队列的忙碌/空闲状态
    - 统计 pending/running/completed/failed 任务数量

## 重试机制详解

### 重试触发条件

1. **Python 进程异常退出**：
   - 外部脚本检测到非零退出码
   - 在 `uni_id.json` 中设置 `state: "abnormal_exit"`
   - 可选设置 `error_type`（如 "oom", "runtime_error"）

2. **重试处理流程**：
   - 调度器检测到 `abnormal_exit` 状态
   - 将任务重置为 "pending" 状态
   - 增加 `retry_count`
   - 根据重试次数决定是否退避
   - 生成新的 `uni_id`

3. **退避策略**：
   - 每 3 次重试后进入退避期
   - 退避时间：10 分钟
   - 退避期间任务不会被调度

### 重试配置

```python
retry_config = RetryConfig(
    max_retry_before_backoff=3,  # 每 3 次重试后进入退避
    backoff_duration=600         # 退避时间 10 分钟
)
```

## 使用示例

### 1. 配置调度器

编辑 `config.yaml` 文件调整参数：
```yaml
# 修改调度间隔
check_time: 10

# 修改 GPU 列表
compete_gpus: [0, 1, 2, 3]

# GPU 配置
gpu_left: 2        # 预留最后 2 张 GPU
min_gpu: 3         # 至少使用 3 张 GPU
# 实际使用: max(3, available-2)

# 修改重试配置
retry_config:
  max_retry_before_backoff: 5
  backoff_duration: 1200  # 20 分钟

# 设置工作目录
work_dir: "/home/user/custom_workspace"  # 绝对路径
# work_dir: "../"                          # 相对路径
# work_dir: null                           # 默认（脚本父目录）
```

### 2. 创建任务配置

**使用优化格式**：
```
# 汽车数据集任务
1 #队列1
"rm -rf {work_dir}/experiments/car196/knowledge_base"
"bash {work_dir}/scripts/set_hyperparameters.sh --experience_number 8"
"bash {work_dir}/scripts/run_pipeline.sh car --uni_id {uni_id}"
20 #显存需求

# 花卉数据集任务
2 #队列2
"rm -rf {work_dir}/experiments/flower102/knowledge_base"
"bash {work_dir}/scripts/set_hyperparameters.sh --experience_number 5"
"bash {work_dir}/scripts/run_pipeline.sh flower --uni_id {uni_id}"
20 #显存需求
```

### 3. 启动调度器

**单GPU模式**：
```bash
cd /home/hdl/project/fgvr_test_new/scripts/compete_gpu_retry
nohup python main_gpu.py > /dev/null 2>&1 &
```

**多GPU模式**：
```bash
cd /home/hdl/project/fgvr_test_new/scripts/compete_gpu_retry
nohup python main_gpus.py > /dev/null 2>&1 &
```

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

**单GPU模式**：编辑 `command_gpu.txt` 文件
**多GPU模式**：编辑 `command_gpus.txt` 文件

## 注意事项

1. **路径独立性**：所有路径相对于脚本位置，便于部署到不同环境
2. **配置管理**：通过 `config.yaml` 统一管理配置，避免修改代码
3. **工作目录**：支持相对路径和绝对路径配置，灵活适应不同部署需求
4. **GPU 配置**：合理设置 `gpu_left` 和 `min_gpu` 参数
   - `gpu_left` 确保其他用户有足够的 GPU 资源
   - `min_gpu` 确保当前用户有足够的 GPU 进行任务调度
5. **命令格式**：
   - 单GPU模式：队列ID → 命令 → 显存需求
   - 多GPU模式：队列ID → 命令 → GPU数量 → 显存需求
6. **多GPU调度**：优先调度GPU需求量大的任务，其次优先队列ID小的任务
7. **日志管理**：日志文件会自动轮转，避免单个文件过大
8. **进程清理**：异常退出的进程需要手动清理或等待系统自动清理
9. **GPU 资源**：确保任务预估的显存需求准确，避免 OOM 错误
10. **队列设计**：合理设计队列数量和任务分配，避免资源浪费
11. **YAML 语法**：编辑配置文件时注意 YAML 语法，特别是缩进和引号
12. **模式选择**：根据任务需求选择单GPU或多GPU模式，两者可以同时运行但使用不同的JSON文件
