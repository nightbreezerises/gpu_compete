# GPU 调度器

一个用于GPU任务调度的管理系统，支持单卡和多卡调度，包含Web控制界面。

## 📁 项目结构

- **调度器代码**: `./app/`
- **配置文件**: `./config/gpu_manage.yaml`
- **命令文件**: 
  - 单卡: `./command_gpu.txt`
  - 多卡: `./command_gpus.txt`
- **前端代码**: `./control/`
- **前端配置**: `./config/control_setting.yaml`

## 🚀 使用方法

### 单卡调度

```bash
# 前台运行
python ./app/main_gpu.py

# 后台运行
nohup python ./app/main_gpu.py > /dev/null 2>&1 &
```

### 多卡调度

```bash
# 后台运行
nohup python ./app/main_gpus.py > /dev/null 2>&1 &
```

### Web控制界面

```bash
# 启动前端
bash ./run_control.sh

# 终止前端
bash ./shut_down.sh
```

## ⚙️ 配置说明

- **GPU管理配置**: `./config/gpu_manage.yaml` - GPU调度相关配置
- **前端配置**: `./config/control_setting.yaml` - 包含登录密码等前端设置，可根据需要自行配置

## 🔐 登录信息

登录密码保存在 `./config/control_setting.yaml` 文件中，可根据需要进行修改。