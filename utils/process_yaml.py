"""
YAML Configuration Processor - YAML 配置文件处理器
"""

import os
import logging
import yaml
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