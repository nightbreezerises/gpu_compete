"""
YAML Configuration Processor - YAML 配置文件处理器
"""

import os
import logging
import yaml
import argparse
from typing import Any, Dict, Optional


class ProcessYAML:
    """YAML 配置文件处理器"""
    
    def __init__(self, file_path: str):
        """初始化
        
        Args:
            file_path: YAML 配置文件路径
        """
        self.file_path = file_path
        self._config = None
    
    def load(self) -> Dict[str, Any]:
        """加载 YAML 配置文件
        
        Returns:
            配置字典
        """
        if not os.path.exists(self.file_path):
            logging.error(f"Config file not found: {self.file_path}")
            return {}
        
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f) or {}
            
            self._config = config
            logging.info(f"✅ Loaded config from {self.file_path}")
            return config
            
        except yaml.YAMLError as e:
            logging.error(f"Failed to parse YAML file {self.file_path}: {e}")
            return {}
        except Exception as e:
            logging.error(f"Error loading config file {self.file_path}: {e}")
            return {}
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取配置项
        
        Args:
            key: 配置键，支持点号分隔的嵌套键（如 'retry_config.max_retry_before_backoff'）
            default: 默认值
            
        Returns:
            配置值
        """
        if self._config is None:
            self.load()
        
        keys = key.split('.')
        value = self._config
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def get_int(self, key: str, default: int = 0) -> int:
        """获取整数配置项
        
        Args:
            key: 配置键
            default: 默认值
            
        Returns:
            整数配置值
        """
        value = self.get(key, default)
        try:
            return int(value)
        except (ValueError, TypeError):
            return default
    
    def get_config(self) -> Dict[str, Any]:
        """获取完整配置
        
        Returns:
            完整配置字典
        """
        if self._config is None:
            self.load()
        return self._config.copy() if self._config else {}
    
    def update(self, key: str, value: Any) -> bool:
        """更新配置项（仅内存中，不保存到文件）
        
        Args:
            key: 配置键
            value: 新值
            
        Returns:
            是否成功
        """
        if self._config is None:
            self.load()
        
        keys = key.split('.')
        config = self._config
        
        try:
            for k in keys[:-1]:
                if k not in config:
                    config[k] = {}
                config = config[k]
            
            config[keys[-1]] = value
            return True
        except Exception as e:
            logging.error(f"Failed to update config {key}: {e}")
            return False


def parse_config_file_path(args: argparse.Namespace, script_dir: str, default_filename: str = "config.yaml") -> str:
    """解析配置文件路径
    
    Args:
        args: 命令行参数对象
        script_dir: 脚本所在目录
        default_filename: 默认配置文件名
        
    Returns:
        配置文件的绝对路径
    """
    if hasattr(args, 'config_file') and args.config_file:
        if os.path.isabs(args.config_file):
            config_path = args.config_file
        else:
            config_path = os.path.abspath(os.path.join(script_dir, args.config_file))
        print(f"使用自定义配置文件: {config_path}")
    else:
        config_path = os.path.join(script_dir, default_filename)
    
    return config_path


def parse_command_file_path(args: argparse.Namespace, script_dir: str, default_filename: str) -> str:
    """解析命令文件路径
    
    Args:
        args: 命令行参数对象
        script_dir: 脚本所在目录
        default_filename: 默认命令文件名
        
    Returns:
        命令文件的绝对路径
    """
    if hasattr(args, 'command_file') and args.command_file:
        if os.path.isabs(args.command_file):
            commands_path = args.command_file
        else:
            commands_path = os.path.abspath(os.path.join(script_dir, args.command_file))
        print(f"使用自定义命令文件: {commands_path}")
    else:
        commands_path = os.path.join(script_dir, default_filename)
    
    return commands_path


def load_config_with_args(args: argparse.Namespace, script_dir: str, default_config_file: str = "config.yaml") -> tuple[ProcessYAML, Dict[str, Any]]:
    """使用命令行参数加载配置
    
    Args:
        args: 命令行参数对象
        script_dir: 脚本所在目录
        default_config_file: 默认配置文件名
        
    Returns:
        (配置处理器对象, 配置字典)
    """
    config_path = parse_config_file_path(args, script_dir, default_config_file)
    config_processor = ProcessYAML(config_path)
    config = config_processor.get_config()
    
    return config_processor, config


def setup_logging(config: Dict[str, Any], log_dir: str) -> None:
    """设置日志配置
    
    Args:
        config: 配置字典
        log_dir: 日志目录
    """
    log_level = config.get('log-level', 'INFO').upper()
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(os.path.join(log_dir, 'app.log')),
            logging.StreamHandler()
        ]
    )


def resolve_work_dir(config: Dict[str, Any], script_dir: str) -> str:
    """解析工作目录路径
    
    Args:
        config: 配置字典
        script_dir: 脚本所在目录
        
    Returns:
        工作目录的绝对路径
    """
    work_dir_config = config.get('work_dir')
    if work_dir_config:
        if os.path.isabs(work_dir_config):
            work_dir = work_dir_config
        else:
            work_dir = os.path.abspath(os.path.join(script_dir, work_dir_config))
    else:
        work_dir = os.path.dirname(script_dir)
    
    return work_dir