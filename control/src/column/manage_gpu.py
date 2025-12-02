#!/usr/bin/env python3
"""
GPU 管理模块
提供类似 nvitop 的 GPU 信息展示功能
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# 尝试导入 nvitop
try:
    from nvitop import Device, GpuProcess, NA
    NVITOP_AVAILABLE = True
except ImportError:
    NVITOP_AVAILABLE = False
    logger.warning("nvitop 未安装，GPU 监控功能不可用")


def get_host_info() -> Dict[str, Any]:
    """获取主机信息"""
    if not NVITOP_AVAILABLE:
        return {"error": "nvitop 未安装"}
    
    try:
        import platform
        import psutil
        
        # CPU 信息
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_count = psutil.cpu_count()
        
        # 内存信息
        mem = psutil.virtual_memory()
        
        # 交换分区
        swap = psutil.swap_memory()
        
        return {
            "hostname": platform.node(),
            "platform": platform.system(),
            "cpu": {
                "count": cpu_count,
                "percent": cpu_percent,
            },
            "memory": {
                "total": mem.total,
                "used": mem.used,
                "free": mem.available,
                "percent": mem.percent,
                "total_human": _format_bytes(mem.total),
                "used_human": _format_bytes(mem.used),
                "free_human": _format_bytes(mem.available),
            },
            "swap": {
                "total": swap.total,
                "used": swap.used,
                "free": swap.free,
                "percent": swap.percent,
                "total_human": _format_bytes(swap.total),
                "used_human": _format_bytes(swap.used),
            },
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"获取主机信息失败: {e}")
        return {"error": str(e)}


def _format_bytes(bytes_val: int) -> str:
    """格式化字节数为人类可读格式"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024:
            return f"{bytes_val:.1f}{unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f}PB"


def _safe_value(val, default="N/A"):
    """安全获取值，处理 NA 类型"""
    if not NVITOP_AVAILABLE:
        return default
    if val is NA or val is None:
        return default
    return val


def _get_clock_infos(device) -> Dict[str, Any]:
    """获取时钟频率信息"""
    try:
        ci = device.clock_infos()
        return {
            "graphics": _safe_value(getattr(ci, 'graphics', None), 0),
            "memory": _safe_value(getattr(ci, 'memory', None), 0),
            "sm": _safe_value(getattr(ci, 'sm', None), 0),
        }
    except Exception:
        return {"graphics": 0, "memory": 0, "sm": 0}


def _get_power_info(device) -> Dict[str, Any]:
    """获取功耗信息"""
    try:
        draw = _safe_value(device.power_usage(), 0)
        limit = _safe_value(device.power_limit(), 0)
        # 功耗单位是毫瓦，转换为瓦
        draw_w = draw / 1000 if draw else 0
        limit_w = limit / 1000 if limit else 0
        return {
            "draw": draw_w,
            "limit": limit_w,
            "draw_human": f"{draw_w:.0f}W" if draw_w else "N/A",
            "limit_human": f"{limit_w:.0f}W" if limit_w else "N/A",
        }
    except Exception:
        return {"draw": 0, "limit": 0, "draw_human": "N/A", "limit_human": "N/A"}


def get_gpu_list() -> List[Dict[str, Any]]:
    """获取所有 GPU 设备列表"""
    if not NVITOP_AVAILABLE:
        return []
    
    try:
        devices = Device.all()
        gpu_list = []
        
        for device in devices:
            gpu_info = get_gpu_info(device)
            gpu_list.append(gpu_info)
        
        return gpu_list
    except Exception as e:
        logger.error(f"获取 GPU 列表失败: {e}")
        return []


def get_gpu_info(device: "Device") -> Dict[str, Any]:
    """获取单个 GPU 的详细信息"""
    if not NVITOP_AVAILABLE:
        return {"error": "nvitop 未安装"}
    
    try:
        # 基本信息
        gpu_info = {
            "index": device.index,
            "name": _safe_value(device.name()),
            "uuid": _safe_value(device.uuid()),
            
            # 显存信息
            "memory": {
                "total": _safe_value(device.memory_total(), 0),
                "used": _safe_value(device.memory_used(), 0),
                "free": _safe_value(device.memory_free(), 0),
                "percent": _safe_value(device.memory_percent(), 0),
                "total_human": _safe_value(device.memory_total_human(), "N/A"),
                "used_human": _safe_value(device.memory_used_human(), "N/A"),
                "free_human": _safe_value(device.memory_free_human(), "N/A"),
            },
            
            # GPU 利用率
            "utilization": {
                "gpu": _safe_value(device.gpu_utilization(), 0),
                "memory": _safe_value(device.memory_utilization(), 0),
            },
            
            # 温度和功耗
            "temperature": _safe_value(device.temperature(), 0),
            "fan_speed": _safe_value(device.fan_speed(), 0),
            "power": _get_power_info(device),
            
            # 时钟频率
            "clocks": _get_clock_infos(device),
            
            # 驱动信息
            "driver_version": _safe_value(device.driver_version(), "N/A"),
            
            # 进程信息
            "processes": get_gpu_processes(device),
            
            # 时间戳
            "timestamp": datetime.now().isoformat(),
        }
        
        return gpu_info
    except Exception as e:
        logger.error(f"获取 GPU {device.index} 信息失败: {e}")
        return {
            "index": device.index if hasattr(device, 'index') else -1,
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }


def get_gpu_processes(device: "Device") -> List[Dict[str, Any]]:
    """获取 GPU 上运行的进程信息"""
    if not NVITOP_AVAILABLE:
        return []
    
    try:
        processes = device.processes()
        process_list = []
        
        for pid, process in processes.items():
            try:
                proc_info = {
                    "pid": pid,
                    "name": _safe_value(process.name(), "N/A"),
                    "username": _safe_value(process.username(), "N/A"),
                    "command": _safe_value(process.command(), "N/A"),
                    "gpu_memory": _safe_value(process.gpu_memory(), 0),
                    "gpu_memory_human": _safe_value(process.gpu_memory_human(), "N/A"),
                    "gpu_memory_percent": _safe_value(process.gpu_memory_percent(), 0),
                    "gpu_sm_utilization": _safe_value(process.gpu_sm_utilization(), 0),
                    "gpu_encoder_utilization": _safe_value(process.gpu_encoder_utilization(), 0),
                    "gpu_decoder_utilization": _safe_value(process.gpu_decoder_utilization(), 0),
                    "cpu_percent": _safe_value(process.cpu_percent(), 0),
                    "memory_percent": _safe_value(process.memory_percent(), 0),
                    "running_time": _safe_value(process.running_time_human(), "N/A"),
                    "type": _safe_value(process.type, "N/A"),
                }
                process_list.append(proc_info)
            except Exception as e:
                logger.warning(f"获取进程 {pid} 信息失败: {e}")
                process_list.append({
                    "pid": pid,
                    "error": str(e),
                })
        
        return process_list
    except Exception as e:
        logger.error(f"获取 GPU 进程列表失败: {e}")
        return []


def get_all_gpu_processes() -> List[Dict[str, Any]]:
    """获取所有 GPU 上的进程（汇总）"""
    if not NVITOP_AVAILABLE:
        return []
    
    try:
        all_processes = []
        devices = Device.all()
        
        for device in devices:
            processes = device.processes()
            for pid, process in processes.items():
                try:
                    proc_info = {
                        "gpu_index": device.index,
                        "gpu_name": _safe_value(device.name(), "N/A"),
                        "pid": pid,
                        "name": _safe_value(process.name(), "N/A"),
                        "username": _safe_value(process.username(), "N/A"),
                        "command": _safe_value(process.command(), "N/A"),
                        "gpu_memory": _safe_value(process.gpu_memory(), 0),
                        "gpu_memory_human": _safe_value(process.gpu_memory_human(), "N/A"),
                        "gpu_memory_percent": _safe_value(process.gpu_memory_percent(), 0),
                        "gpu_sm_utilization": _safe_value(process.gpu_sm_utilization(), 0),
                        "cpu_percent": _safe_value(process.cpu_percent(), 0),
                        "memory_percent": _safe_value(process.memory_percent(), 0),
                        "running_time": _safe_value(process.running_time_human(), "N/A"),
                    }
                    all_processes.append(proc_info)
                except Exception as e:
                    logger.warning(f"获取进程 {pid} 信息失败: {e}")
        
        return all_processes
    except Exception as e:
        logger.error(f"获取所有 GPU 进程失败: {e}")
        return []


def get_gpu_summary() -> Dict[str, Any]:
    """获取 GPU 概要信息"""
    if not NVITOP_AVAILABLE:
        return {
            "available": False,
            "error": "nvitop 未安装，请运行: pip install nvitop",
            "gpu_count": 0,
            "gpus": [],
            "timestamp": datetime.now().isoformat(),
        }
    
    try:
        devices = Device.all()
        gpu_count = len(devices)
        
        # 统计信息
        total_memory = 0
        used_memory = 0
        total_processes = 0
        users = set()
        
        gpus = []
        for device in devices:
            gpu_info = get_gpu_info(device)
            gpus.append(gpu_info)
            
            total_memory += gpu_info["memory"]["total"]
            used_memory += gpu_info["memory"]["used"]
            total_processes += len(gpu_info["processes"])
            
            for proc in gpu_info["processes"]:
                if proc.get("username") and proc["username"] != "N/A":
                    users.add(proc["username"])
        
        return {
            "available": True,
            "gpu_count": gpu_count,
            "total_memory": total_memory,
            "used_memory": used_memory,
            "total_memory_human": _format_bytes(total_memory),
            "used_memory_human": _format_bytes(used_memory),
            "memory_percent": round(used_memory / total_memory * 100, 1) if total_memory > 0 else 0,
            "total_processes": total_processes,
            "active_users": list(users),
            "active_user_count": len(users),
            "gpus": gpus,
            "host": get_host_info(),
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"获取 GPU 概要信息失败: {e}")
        return {
            "available": False,
            "error": str(e),
            "gpu_count": 0,
            "gpus": [],
            "timestamp": datetime.now().isoformat(),
        }


# 导出的函数
__all__ = [
    "get_gpu_summary",
    "get_gpu_list",
    "get_gpu_info",
    "get_gpu_processes",
    "get_all_gpu_processes",
    "get_host_info",
    "NVITOP_AVAILABLE",
]