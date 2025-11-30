# 竞争GPU管理逻辑

## 概述

为了有效管理多个脚本对GPU资源的竞争使用，我们实现了一个基于唯一标识符（uni_id）的进程管理系统。该系统允许外部监控脚本（如 `main.py`）跟踪正在运行的Python进程，并在适当的时机启动新的任务。

## 代码结构（模块化版本）

```
scripts/compete_gpu_retry/
├── main.py                     # 主调度器
├── config.yaml                # 调度器配置文件
├── command.txt                # 任务配置文件
├── logs/                      # 日志目录（相对于脚本）
│   ├── compete_gpu*.log      # 调度器日志
│   └── uni_id.json           # 进程状态记录
└── utils/
    ├── __init__.py
    ├── gpu_monitor.py         # GPU 状态监控
    ├── process_json.py        # JSON 文件管理
    ├── process_yaml.py        # YAML 配置文件管理
    ├── retry.py               # 重试机制
    └── parse_command_file.py  # 命令配置文件解析器
```

### 模块说明

| 模块 | 功能 |
|------|------|
| `gpu_monitor.py` | GPU 显存检测、用户进程检测、GPU 列表探测 |
| `process_json.py` | uni_id.json 文件的读写、进程状态管理 |
| `process_yaml.py` | YAML 配置文件管理，支持嵌套键访问 |
| `retry.py` | 重试配置、退避策略、任务状态检查 |
| `parse_command_file.py` | 命令配置文件解析器 |
| `config.yaml` | 调度器配置文件，包含所有运行参数 |
| `command.txt` | 任务配置文件，便于管理和修改 |
| `command_bk.txt` | 备用任务配置文件，支持优化格式 |

### 路径配置

所有路径都相对于脚本位置，便于部署：

- `work_dir`: 脚本父目录，用于命令执行
- `log_dir`: `./logs`（相对于脚本），存放日志和进程状态文件
- `process_json_path`: `./logs/uni_id.json`，进程状态记录文件
- `commands_path`: `./command.txt`，任务配置文件
- `config_path`: `./config.yaml`，YAML 配置文件

### 配置管理

使用 YAML 文件管理所有配置参数，便于修改和维护：

#### config.yaml 格式

```yaml
# 调度配置
check_time: 5  # 调度间隔（秒）
maximize_resource_utilization: false  # 极限利用资源模式

# GPU 配置
compete_gpus: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]  # 手动指定的 GPU 列表
use_all_gpus: true  # 是否自动探测所有 GPU
gpu_left: 1  # 剩余几张卡给其他用户

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
```

#### GPU 预留配置详解

`gpu_left` 配置用于预留 GPU 给其他用户：

1. **配置方式**：
   ```yaml
   gpu_left: 0   # 不预留，使用所有可用 GPU
   gpu_left: 1   # 预留 1 张 GPU（通常是最后一张）
   gpu_left: 2   # 预留 2 张 GPU（通常是最后两张）
   ```

2. **预留逻辑**：
   - 当 `use_all_gpus: true` 时，从检测到的所有 GPU 中预留最后 `gpu_left` 张
   - 当 `use_all_gpus: false` 时，从手动指定的 GPU 列表中预留最后 `gpu_left` 张
   - 预留的 GPU 不会被调度器使用

3. **示例**：
   ```yaml
   # 检测到 10 张 GPU [0,1,2,3,4,5,6,7,8,9]，gpu_left: 1
   # 可用 GPU: [0,1,2,3,4,5,6,7,8]
   # 预留 GPU: [9]
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

核心逻辑：**队列内串行，队列间并行，顺序分配**执行进程。

- **队列内串行**：同一队列的任务严格按顺序执行，前一个任务完成后才能启动下一个
- **队列间并行**：不同队列的任务可以同时在不同 GPU 上执行
- **顺序分配**：每次只分配一个任务，等待进程确认启动后（30秒延迟）再分配下一个，避免 GPU 进程未及时显示导致重复分配
- **重试机制**：进程发生异常后要进行重试，重试超上限（3次）后退避一段时间（10分钟）再进行下一次重试
- **GPU 预留**：根据配置预留指定数量的 GPU 给其他用户使用

整体流程：**任务配置 → 队列分组 → GPU 预留处理 → 空闲队列头任务随机调度 → 逐个分配 GPU → 等待进程确认 → 状态监控**。

### 1. 任务与队列

1. 所有待执行任务从 `command.txt` 文件中读取。
2. 启动时脚本为每个任务生成唯一的 `uni_id`，并构造成 `Task` 对象，**暂不绑定具体 GPU**。

#### command.txt 格式说明

**标准格式**：
```
# 注释行（以 # 开头）
# 空行分隔不同任务

# 任务1：队列1
命令1
命令2
命令3
队列ID,显存需求(GB)

# 任务2：队列2
命令1
命令2
队列ID,显存需求(GB)
```

**优化格式（command_bk.txt）**：
```
# 注释行（以 # 开头）
# 空行分隔不同任务

# 任务1：队列1
1 #队列ID
"rm -rf {work_dir}/experiments/car196/knowledge_base"
"bash {work_dir}/scripts/set_hyperparameters.sh --experience_number 8"
"bash {work_dir}/scripts/run_pipeline.sh car --uni_id {uni_id}"
20 #剩余显存

# 任务2：队列2
2
"rm -rf {work_dir}/experiments/flower102/knowledge_base"
"bash {work_dir}/scripts/set_hyperparameters.sh --experience_number 5"
"bash {work_dir}/scripts/run_pipeline.sh flower --uni_id {uni_id}"
20
```

**支持的变量**：
- `{work_dir}` - 工作目录（脚本父目录）
- `{uni_id}` - 唯一标识符（自动生成）

**格式特点**：
- 队列ID在第一行
- 命令行在中间，可以用引号包围
- 显存需求在最后一行
- 数字后可以跟注释（如 `1 #队列ID`）
- 解析器会自动读取第一个数字作为值

#### parse_command_file.py 模块

负责解析命令配置文件，支持两种格式：

**主要功能**：
- 解析注释和空行
- 提取命令列表
- 智能解析队列ID和显存需求（支持数字后注释）
- 错误处理和日志记录

**使用方式**：
```python
from utils import parse_command_file

tasks = parse_command_file('command.txt')
# 返回: List[(commands, queue_id, memory_gb)]
```

3. 根据队列 ID 将任务分组：
   - **同一队列内**：严格按顺序执行（队列内串行）
   - **不同队列之间**：可同时调度（队列间并行）

### 2. GPU 分配与进程管理

4. **GPU 竞争范围配置**：
   - `use_all_gpus=True`：自动探测所有可用 GPU
   - `use_all_gpus=False`：使用 `compete_gpus` 指定的 GPU 列表

5. **GPU 预留处理**：
   - 根据 `gpu_left` 配置预留 GPU
   - 预留的 GPU 不会被调度器使用
   - 通常预留最后几张 GPU（编号较大的）

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

# 预留 GPU 给其他用户
gpu_left: 2  # 预留最后 2 张 GPU

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

**使用优化格式（command_bk.txt）**：
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

```bash
cd /home/hdl/project/fgvr_test_new/scripts/compete_gpu_retry
nohup python main.py > /dev/null 2>&1 &
```

### 4. 查看日志

```bash
tail -f logs/compete_gpu.log
```

### 5. 查看进程状态

```bash
cat logs/uni_id.json | python -m json.tool
```

### 6. 修改任务配置

编辑 `command.txt` 或 `command_bk.txt` 文件，添加或修改任务块。

## 注意事项

1. **路径独立性**：所有路径相对于脚本位置，便于部署到不同环境
2. **配置管理**：通过 `config.yaml` 统一管理配置，避免修改代码
3. **工作目录**：支持相对路径和绝对路径配置，灵活适应不同部署需求
4. **GPU 预留**：合理设置 `gpu_left` 避免影响其他用户，通常预留 1-2 张 GPU
5. **命令格式**：建议使用优化格式（command_bk.txt），队列ID在第一行，命令在中间，显存在最后一行
6. **日志管理**：日志文件会自动轮转，避免单个文件过大
7. **进程清理**：异常退出的进程需要手动清理或等待系统自动清理
8. **GPU 资源**：确保任务预估的显存需求准确，避免 OOM 错误
9. **队列设计**：合理设计队列数量和任务分配，避免资源浪费
10. **YAML 语法**：编辑配置文件时注意 YAML 语法，特别是缩进和引号
