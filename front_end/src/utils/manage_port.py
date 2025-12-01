#!/usr/bin/env python3
"""
端口管理模块
包含端口检测、自动端口选择、进程信息管理等功能
"""

import socket
import logging
import os
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# 获取项目根目录（相对路径）
FRONT_END_DIR = Path(__file__).parent.parent.parent  # front_end 目录
PID_FILE = FRONT_END_DIR / "logs" / "pid.json"


def is_port_available(port: int, host: str = "0.0.0.0") -> bool:
    """检查指定端口是否可用"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            result = sock.connect_ex((host, port))
            return result != 0
    except Exception as e:
        logger.warning(f"检查端口 {port} 时发生错误: {e}")
        return False


def find_available_port(start_port: int, host: str = "0.0.0.0", max_attempts: int = 100) -> Tuple[int, int]:
    """从指定端口开始查找可用端口，返回 (原始端口, 实际端口)"""
    original_port = start_port
    
    if is_port_available(start_port, host):
        logger.info(f"端口 {start_port} 可用")
        return original_port, start_port
    
    logger.warning(f"端口 {start_port} 被占用，开始查找可用端口...")
    
    for port in range(start_port + 1, start_port + max_attempts + 1):
        if is_port_available(port, host):
            logger.info(f"找到可用端口: {port} (原端口: {start_port})")
            return original_port, port
    
    raise RuntimeError(f"无法在端口范围 {start_port}-{start_port + max_attempts} 内找到可用端口")


def validate_port_range(port: int) -> bool:
    """验证端口号是否在有效范围内 (1-65535)"""
    return 1 <= port <= 65535


def get_local_ip() -> str:
    """获取本机IP地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_port_info(port: int) -> Optional[dict]:
    """获取端口占用信息"""
    try:
        import psutil
        for conn in psutil.net_connections():
            if conn.laddr.port == port:
                try:
                    process = psutil.Process(conn.pid)
                    return {
                        'pid': conn.pid,
                        'name': process.name(),
                        'cmdline': ' '.join(process.cmdline()),
                        'status': conn.status,
                        'address': conn.laddr.ip
                    }
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    return {'pid': conn.pid, 'name': 'unknown', 'cmdline': 'unknown', 'status': conn.status, 'address': conn.laddr.ip}
        return None
    except ImportError:
        logger.warning("psutil 未安装，无法获取详细的端口占用信息")
        return None
    except Exception as e:
        logger.error(f"获取端口 {port} 信息时发生错误: {e}")
        return None


def log_port_change(original_port: int, new_port: int, host: str = "0.0.0.0"):
    """记录端口变更信息到日志和终端"""
    if original_port != new_port:
        port_info = get_port_info(original_port)
        logger.warning("=" * 50)
        logger.warning("⚠️  端口冲突处理")
        logger.warning(f"原端口 {original_port} 被占用")
        if port_info:
            logger.warning(f"占用进程: PID={port_info['pid']}, 名称={port_info['name']}")
        logger.warning(f"自动切换到端口: {new_port}")
        logger.warning("=" * 50)
        print(f"⚠️  端口 {original_port} 被占用，自动切换到端口 {new_port}")
    else:
        logger.info(f"使用配置端口: {new_port}")
        print(f"✅ 端口 {new_port} 可用，服务启动中...")


def is_process_running(pid: int) -> bool:
    """检查指定 PID 的进程是否正在运行"""
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def register_process_info(port: int, host: str = "0.0.0.0") -> bool:
    """将当前进程的 PID 和端口信息写入 pid.json 文件"""
    try:
        pid = os.getpid()
        local_ip = get_local_ip()
        
        PID_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        instances = []
        if PID_FILE.exists():
            try:
                with open(PID_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, dict) and 'instances' in data:
                        instances = data['instances']
            except (json.JSONDecodeError, KeyError):
                instances = []
        
        # 清理已停止的进程
        instances = [inst for inst in instances if is_process_running(inst.get('pid', 0))]
        
        # 添加当前进程信息
        process_info = {
            "instance": len(instances) + 1,
            "pid": pid,
            "port": port,
            "host": host,
            "ip": local_ip,
            "url": f"http://{local_ip}:{port}",
            "start_time": datetime.now().isoformat(),
            "start_timestamp": int(datetime.now().timestamp())
        }
        instances.append(process_info)
        
        with open(PID_FILE, 'w', encoding='utf-8') as f:
            json.dump({"instances": instances}, f, indent=2, ensure_ascii=False)
        
        logger.info(f"进程信息已注册: PID={pid}, Port={port}, URL=http://{local_ip}:{port}")
        return True
    except Exception as e:
        logger.error(f"注册进程信息失败: {e}")
        return False


def unregister_process_info() -> bool:
    """从 pid.json 中移除当前进程的信息"""
    try:
        pid = os.getpid()
        if not PID_FILE.exists():
            return True
        
        with open(PID_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict) and 'instances' in data:
            instances = [inst for inst in data['instances'] if inst.get('pid') != pid]
            with open(PID_FILE, 'w', encoding='utf-8') as f:
                json.dump({"instances": instances}, f, indent=2, ensure_ascii=False)
        
        logger.info(f"进程信息已注销: PID={pid}")
        return True
    except Exception as e:
        logger.error(f"注销进程信息失败: {e}")
        return False


def cleanup_pid_file() -> bool:
    """清理 pid.json 文件，移除已停止的进程"""
    try:
        if not PID_FILE.exists():
            return True
        
        with open(PID_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict) and 'instances' in data:
            instances = data['instances']
            active = [inst for inst in instances if is_process_running(inst.get('pid', 0))]
            for i, inst in enumerate(active, 1):
                inst['instance'] = i
            
            with open(PID_FILE, 'w', encoding='utf-8') as f:
                json.dump({"instances": active}, f, indent=2, ensure_ascii=False)
            
            if len(instances) - len(active) > 0:
                logger.info(f"清理了 {len(instances) - len(active)} 个已停止的进程记录")
        
        return True
    except Exception as e:
        logger.error(f"清理 PID 文件失败: {e}")
        return False


def get_all_instances() -> list:
    """获取所有注册的实例信息"""
    try:
        if not PID_FILE.exists():
            return []
        with open(PID_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict) and 'instances' in data:
            return [inst for inst in data['instances'] if is_process_running(inst.get('pid', 0))]
        return []
    except Exception as e:
        logger.error(f"获取实例信息失败: {e}")
        return []
