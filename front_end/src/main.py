#!/usr/bin/env python3
import os
import sys
import yaml
import logging
from pathlib import Path
from typing import Any, Dict, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError

# 导入自定义模块
from column.config_rule import create_yaml_handler
from column.manage_gpu import get_gpu_summary, get_all_gpu_processes, NVITOP_AVAILABLE
from column.setting import create_settings_handler
from column.config_command import create_command_handler
from utils.manage_port import (
    find_available_port, log_port_change, validate_port_range,
    register_process_info, unregister_process_info, cleanup_pid_file
)

# 读取配置文件
def load_settings() -> Dict[str, Any]:
    """读取 config.yaml 配置文件"""
    config_file = Path(__file__).parent.parent / "config.yaml"
    if not config_file.is_file():
        raise FileNotFoundError(f"配置文件不存在: {config_file}")
    with config_file.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}

# 从配置文件加载设置
settings = load_settings()

# 根据配置设置常量
TARGET_YAML_PATH = Path(__file__).parent.parent / settings["target-yaml-path"]
STATIC_DIR = Path(__file__).parent / "dashboard" / "dist"
LOG_DIR = Path(__file__).parent.parent / "logs"  # 修改为使用 front_end/logs

# 端口处理 - 检测冲突并自动选择可用端口
CONFIG_PORT = settings.get("port", 29214)
BIND_ADDRESS = settings.get("bind-address", "0.0.0.0")

# 验证端口范围
if not validate_port_range(CONFIG_PORT):
    print(f"❌ 配置的端口 {CONFIG_PORT} 不在有效范围内 (1-65535)")
    raise ValueError(f"无效的端口号: {CONFIG_PORT}")

# 查找可用端口
original_port, actual_port = find_available_port(CONFIG_PORT, BIND_ADDRESS)

# 设置实际使用的端口
PORT = actual_port

ALLOW_LAN = settings.get("allow-lan", True)
LOG_LEVEL = settings.get("log-level", "info")
SECRET = settings.get("secret", "admin")  # 访问密钥

# 设置日志
def setup_logging():
    """设置日志配置"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    
    # 配置日志（仅输出到控制台，由脚本管理日志文件）
    logging.basicConfig(
        level=getattr(logging, settings.get('log-level', 'info').upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    return logging.getLogger(__name__)

# 初始化日志
logger = setup_logging()

# 创建处理器
yaml_handler = create_yaml_handler(TARGET_YAML_PATH)
settings_handler = create_settings_handler()
command_handler = create_command_handler()

# 读取配置函数
def load_config() -> Dict[str, Any]:
    """读取配置文件"""
    try:
        return yaml_handler.load_config()
    except Exception as e:
        logger.error(f"读取配置失败: {e}")
        raise

logger.info(f"配置编辑器启动 - 目标文件: {TARGET_YAML_PATH}")
logger.info(f"服务端口: {PORT}, 绑定地址: {BIND_ADDRESS}")

# 记录端口变更信息（在日志初始化后）
log_port_change(original_port, actual_port, BIND_ADDRESS)

# FastAPI 应用
app = FastAPI(
    title="Config Editor API",
    description="API to read/write config.yaml",
    version="1.0.0",
)

# 注意：SECRET 已在第 59 行从 front_end/config.yaml 读取

# 数据模型（用于校验 GPU 配置）
class ConfigModel(BaseModel):
    check_time: int
    maximize_resource_utilization: bool
    compete_gpus: list
    use_all_gpus: bool
    gpu_left: int
    min_gpu: int
    retry_config: dict
    work_dir: Optional[str] = None  # 允许 None 值
    gpu_command_file: str
    gpus_command_file: str

    class Config:
        allow_population_by_field_name = True

@app.get("/api/config")
def get_config():
    """返回当前配置（JSON）"""
    try:
        logger.info("收到获取配置请求")
        cfg = load_config()
        # 直接返回原始配置，GPU 配置不需要键名转换
        logger.info("成功获取配置数据")
        return cfg
    except Exception as e:
        logger.error(f"获取配置失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/check")
def check_auth():
    """检查是否需要认证"""
    try:
        logger.info("收到认证检查请求")
        if SECRET == "" or SECRET.lower() in ["none", "null", "false"]:
            return {"requires_auth": False}
        else:
            return {"requires_auth": True}
    except Exception as e:
        logger.error(f"检查认证失败: {e}")
        return {"requires_auth": True}

@app.post("/api/auth/login")
def login(login_data: dict):
    """登录验证"""
    try:
        logger.info("收到登录请求")
        password = login_data.get("password", "")
        
        if SECRET == "" or SECRET.lower() in ["none", "null", "false"]:
            return {"success": True, "message": "无需认证"}
        elif password == SECRET:
            return {"success": True, "message": "登录成功"}
        else:
            return {"success": False, "message": "密码错误"}
    except Exception as e:
        logger.error(f"登录验证失败: {e}")
        return {"success": False, "message": "登录失败"}

@app.put("/api/config")
def update_config(data: Dict[str, Any]):
    """更新配置"""
    try:
        logger.info("收到保存配置请求")
        
        # 校验数据
        try:
            validated_data = ConfigModel(**data).dict()
        except ValidationError as e:
            logger.error(f"参数校验失败: {e}")
            raise HTTPException(status_code=400, detail=f"参数校验失败: {e}")
        
        # 保存配置
        save_config(validated_data)
        logger.info("配置更新成功")
        
        return {"status": "ok", "data": validated_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新配置失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== GPU 管理 API ====================

@app.get("/api/gpu")
def get_gpu_info_api():
    """获取 GPU 概要信息（类似 nvitop）"""
    try:
        logger.info("收到获取 GPU 信息请求")
        summary = get_gpu_summary()
        return summary
    except Exception as e:
        logger.error(f"获取 GPU 信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gpu/processes")
def get_gpu_processes_api():
    """获取所有 GPU 进程信息"""
    try:
        logger.info("收到获取 GPU 进程请求")
        processes = get_all_gpu_processes()
        return {"processes": processes, "count": len(processes)}
    except Exception as e:
        logger.error(f"获取 GPU 进程失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gpu/status")
def get_gpu_status_api():
    """获取 GPU 监控状态（无需认证，用于健康检查）"""
    return {
        "nvitop_available": NVITOP_AVAILABLE,
        "timestamp": datetime.now().isoformat(),
    }

# ==================== 命令配置 API ====================

@app.get("/api/commands/{mode}")
def get_commands_api(mode: str):
    """获取命令配置"""
    try:
        logger.info(f"收到获取命令配置请求，模式: {mode}")
        
        if mode not in ["single", "multi"]:
            raise HTTPException(status_code=400, detail="无效的模式，必须是 'single' 或 'multi'")
        
        config_data = command_handler.load_command_config(mode)
        return config_data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取命令配置失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/commands/{mode}")
def update_commands_api(
    mode: str, 
    config_data: dict
):
    """更新命令配置"""
    try:
        logger.info(f"收到更新命令配置请求，模式: {mode}")
        
        if mode not in ["single", "multi"]:
            raise HTTPException(status_code=400, detail="无效的模式，必须是 'single' 或 'multi'")
        
        # 验证配置数据
        errors = command_handler.validate_command_config(config_data, mode)
        if errors:
            raise HTTPException(
                status_code=400, 
                detail=f"验证失败: {', '.join([f'{k}: {v}' for k, v in errors.items()])}"
            )
        
        # 保存配置
        success = command_handler.save_command_config(config_data, mode)
        if not success:
            raise HTTPException(status_code=500, detail="保存配置失败")
        
        logger.info(f"命令配置更新成功，模式: {mode}")
        
        return {
            "message": "命令配置保存成功",
            "mode": mode,
            "queues_count": len(config_data.get("queues", []))
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新命令配置失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/commands/{mode}/reset")
def reset_commands_api(mode: str):
    """重置命令配置到备份文件"""
    try:
        logger.info(f"收到重置命令配置请求，模式: {mode}")
        
        if mode not in ["single", "multi"]:
            raise HTTPException(status_code=400, detail="无效的模式，必须是 'single' 或 'multi'")
        
        # 重置配置
        success = command_handler.reset_command_config(mode)
        if not success:
            raise HTTPException(status_code=500, detail="重置配置失败")
        
        logger.info(f"命令配置重置成功，模式: {mode}")
        
        return {
            "message": "命令配置重置成功",
            "mode": mode
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重置命令配置失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 系统设置 API ====================

@app.get("/api/settings")
def get_settings_api():
    """获取系统设置"""
    try:
        logger.info("收到获取系统设置请求")
        settings_data = settings_handler.load_settings()
        
        # 添加设置项信息
        settings_with_info = {}
        for key, value in settings_data.items():
            info = settings_handler.get_setting_info(key)
            settings_with_info[key] = {
                "value": value,
                "requires_restart": info["requires_restart"],
                "warning": info["warning"],
                "description": info["description"]
            }
        
        return settings_with_info
    except Exception as e:
        logger.error(f"获取系统设置失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/settings")
def update_settings_api(settings_data: dict):
    """更新系统设置"""
    try:
        logger.info("收到更新系统设置请求")
        
        # 验证设置数据
        errors = settings_handler.validate_settings(settings_data)
        if errors:
            raise HTTPException(
                status_code=400, 
                detail=f"验证失败: {', '.join([f'{k}: {v}' for k, v in errors.items()])}"
            )
        
        # 保存设置
        success = settings_handler.save_settings(settings_data)
        if not success:
            raise HTTPException(status_code=500, detail="保存设置失败")
        
        # 检查需要重启的设置项
        restart_settings = []
        for key in settings_data:
            info = settings_handler.get_setting_info(key)
            if info["requires_restart"]:
                restart_settings.append(key)
        
        logger.info(f"系统设置更新成功，需要重启的设置: {restart_settings}")
        
        return {
            "message": "设置保存成功",
            "requires_restart": restart_settings,
            "warnings": [settings_handler.get_setting_info(k)["warning"] 
                       for k in settings_data 
                       if settings_handler.get_setting_info(k)["warning"]]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新系统设置失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 静态文件服务（前端构建产物）
from fastapi.responses import RedirectResponse, HTMLResponse

if STATIC_DIR.is_dir():
    # 挂载静态资源（CSS、JS等）
    app.mount("/ui/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")
    
    # 挂载图片资源
    images_dir = STATIC_DIR / "images"
    if images_dir.is_dir():
        app.mount("/ui/images", StaticFiles(directory=str(images_dir)), name="images")
    
    # 根路径重定向到 /ui/
    @app.get("/")
    def redirect_to_ui():
        return RedirectResponse(url="/ui/")
    
    # SPA 路由处理 - 所有 /ui/* 路径都返回 index.html
    @app.get("/ui/{full_path:path}")
    def serve_spa(full_path: str):
        index_file = STATIC_DIR / "index.html"
        if index_file.is_file():
            return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
        return {"detail": "index.html not found"}
else:
    @app.get("/")
    def read_root():
        return {"message": "前端构建产物不存在，请先在 front_end 目录下运行 npm run build"}

if __name__ == "__main__":
    import uvicorn
    import atexit
    import signal
    
    # 清理旧的 PID 文件记录
    cleanup_pid_file()
    
    # 注册进程信息（包含端口）
    register_process_info(PORT, BIND_ADDRESS)
    
    # 注册退出时清理函数
    def cleanup_on_exit():
        unregister_process_info()
    
    atexit.register(cleanup_on_exit)
    
    # 处理信号
    def signal_handler(signum, frame):
        cleanup_on_exit()
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # 使用配置文件中的端口设置
    uvicorn.run(app, host=BIND_ADDRESS, port=PORT)