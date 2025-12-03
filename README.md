```md
# GPU 调度系统使用说明

本项目包含 **GPU 调度后端** 与 **前端控制界面** 两部分，分别位于不同目录，支持单卡与多卡任务调度。

---

## 一、后端调度器（Scheduler）

后端调度相关代码位于：

```

./app

````

---

### 1. 单卡调度运行方式

#### 前台运行（调试推荐）

```bash
python ./app/main_gpu.py
````

#### 后台运行（服务器常用）

```bash
nohup python ./app/main_gpu.py > /dev/null 2>&1 &
```

---

### 2. 多卡调度运行方式（后台）

```bash
nohup python ./app/main_gpus.py > /dev/null 2>&1 &
```

---

### 3. 配置文件说明

* GPU 调度器配置文件路径：

```bash
./config/gpu_manage.yaml
```

* 该文件用于配置 GPU 资源管理、队列策略等参数

---

### 4. 命令文件说明

* 单卡任务命令文件：

```bash
./command_gpu.txt
```

* 多卡任务命令文件：

```bash
./command_gpus.txt
```

命令文件用于定义具体的任务执行指令、显存要求、队列编号等信息。

---

## 二、前端控制系统（Web Control）

前端相关代码位于：

```
./control
```

---

### 1. 启动前端服务

```bash
bash ./run_control.sh
```

---

### 2. 前端登录与配置说明

前端登录密码及前端相关配置保存在：

```bash
./config/control_setting.yaml
```

你可以在该文件中自行修改：

* 登录密码
* 端口号
* 页面相关配置

---

### 3. 关闭前端服务

```bash
bash ./shut_down.sh
```

---

## 三、常见运行模式推荐

| 使用场景   | 推荐命令                                                 |
| ------ | ---------------------------------------------------- |
| 本地调试   | `python ./app/main_gpu.py`                           |
| 单卡后台运行 | `nohup python ./app/main_gpu.py > /dev/null 2>&1 &`  |
| 多卡后台运行 | `nohup python ./app/main_gpus.py > /dev/null 2>&1 &` |
| 启动前端   | `bash ./run_control.sh`                              |
| 关闭前端   | `bash ./shut_down.sh`                                |

---

## 四、注意事项

1. 确保已正确配置：

   * `./config/gpu_manage.yaml`
   * `./config/control_setting.yaml`
2. 确保所有 `.sh` 脚本具备可执行权限：

   ```bash
   chmod +x *.sh
   ```
3. 后台运行可通过以下方式查看进程：

   ```bash
   ps -ef | grep main_gpu.py
   ps -ef | grep main_gpus.py
   ```

---

✅ 本文档适用于：

* 单机多 GPU 服务器
* 长时间后台训练调度
* Web 可视化任务管理

```

---

如果你愿意，我还可以帮你再加一版：

- ✅ **项目目录结构树**
- ✅ **完整使用流程图**
- ✅ **常见报错与排查表**

这样就可以直接作为你项目的正式 `README.md` 了。
```
