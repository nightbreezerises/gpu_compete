#!/usr/bin/env python3
"""
YAML 配置文件处理模块
提供读取、保存和格式化 YAML 配置文件的功能
"""

import re
import logging
from pathlib import Path
from typing import Any, Dict
from ruamel.yaml import YAML

logger = logging.getLogger(__name__)


class YAMLConfigHandler:
    """YAML 配置文件处理器"""
    
    def __init__(self, target_path: Path):
        """
        初始化 YAML 处理器
        
        Args:
            target_path: 目标 YAML 文件路径
        """
        self.target_path = target_path
        self.ryaml = YAML()
        self.ryaml.preserve_quotes = True
        self.ryaml.width = 4096  # 避免数组换行
    
    def load_config(self) -> Dict[str, Any]:
        """
        读取目标 YAML 文件
        
        Returns:
            配置数据字典
            
        Raises:
            FileNotFoundError: 文件不存在
        """
        logger.info(f"读取配置文件: {self.target_path}")
        if not self.target_path.is_file():
            logger.error(f"目标配置文件不存在: {self.target_path}")
            raise FileNotFoundError(f"目标配置文件不存在: {self.target_path}")
        
        with self.target_path.open("r", encoding="utf-8") as f:
            data = self.ryaml.load(f) or {}
        
        logger.info(f"成功读取配置，包含 {len(data)} 个顶级键")
        return data
    
    def save_config(self, data: Dict[str, Any]) -> None:
        """
        写入目标 YAML 文件 - 使用字符串替换保持原始格式
        
        Args:
            data: 要保存的配置数据
        """
        logger.info("开始保存配置")
        
        try:
            # 读取原始文件内容
            if self.target_path.is_file():
                with self.target_path.open("r", encoding="utf-8") as f:
                    content = f.read()
            else:
                content = ""
            
            # 处理简单键值对
            simple_keys = ['check_time', 'maximize_resource_utilization', 'memory_save_mode', 'compete_gpus', 
                           'use_all_gpus', 'gpu_left', 'min_gpu', 'max_gpu', 'work_dir',
                           'gpu_command_file', 'gpus_command_file']
            
            for key in simple_keys:
                if key in data:
                    value = data[key]
                    formatted_value = self._format_value(key, value)
                    # 匹配: key: value  # comment 或 key: value
                    pattern = rf'^({key}:\s*)([^\n#]*)(#.*)?$'
                    
                    def replace_func(match, fv=formatted_value):
                        prefix = match.group(1)  # "key: "
                        comment = match.group(3) or ""  # "# comment" 或空
                        if comment:
                            return f"{prefix}{fv}  {comment}"
                        else:
                            return f"{prefix}{fv}"
                    
                    content = re.sub(pattern, replace_func, content, flags=re.MULTILINE)
            
            # 处理嵌套的 retry_config
            if 'retry_config' in data and isinstance(data['retry_config'], dict):
                content = self._process_retry_config(data['retry_config'], content)
            
            # 写入文件
            with self.target_path.open("w", encoding="utf-8") as f:
                f.write(content)
            
            logger.info("配置保存成功")
        except Exception as e:
            logger.error(f"配置保存失败: {e}")
            raise
    
    def _format_value(self, key: str, value: Any) -> str:
        """
        根据值类型格式化输出
        
        Args:
            key: 配置键名
            value: 配置值
            
        Returns:
            格式化后的字符串
        """
        if value is None:
            return "null"
        elif isinstance(value, bool):
            return "true" if value else "false"
        elif isinstance(value, list):
            # 保持数组行内格式
            return "[" + ", ".join(str(v) for v in value) + "]"
        elif isinstance(value, str):
            # 检查是否应该转换为数字
            if key in ['check_time', 'gpu_left', 'min_gpu', 'max_gpu', 'max_retry_before_backoff', 'backoff_duration']:
                if value.strip() == '':
                    return "null"  # 空字符串转为 null
                try:
                    num_val = int(value)
                    return str(num_val)  # 转换为数字字符串
                except ValueError:
                    return value  # 无法转换则保持原值
            
            # 其他字符串字段，如果包含特殊字符，加引号
            if any(c in value for c in [':', '#', '[', ']', '{', '}', ',', '&', '*', '?', '|', '-', '<', '>', '=', '!', '%', '@', '`']):
                return f'"{value}"'
            return value
        else:
            return str(value)
    
    def _process_retry_config(self, retry_config: Dict[str, Any], content: str) -> str:
        """
        处理嵌套的 retry_config 配置
        
        Args:
            retry_config: 重试配置字典
            content: 原始文件内容
            
        Returns:
            处理后的文件内容
        """
        if 'max_retry_before_backoff' in retry_config:
            pattern = r'^(\s*max_retry_before_backoff:\s*)([^\n#]*)(#.*)?$'
            def replace_func(match, val=retry_config['max_retry_before_backoff']):
                prefix = match.group(1)
                comment = match.group(3) or ""
                formatted_val = self._format_nested_value(val)
                if comment:
                    return f"{prefix}{formatted_val}  {comment}"
                else:
                    return f"{prefix}{formatted_val}"
            content = re.sub(pattern, replace_func, content, flags=re.MULTILINE)
        
        if 'backoff_duration' in retry_config:
            pattern = r'^(\s*backoff_duration:\s*)([^\n#]*)(#.*)?$'
            def replace_func(match, val=retry_config['backoff_duration']):
                prefix = match.group(1)
                comment = match.group(3) or ""
                formatted_val = self._format_nested_value(val)
                if comment:
                    return f"{prefix}{formatted_val}  {comment}"
                else:
                    return f"{prefix}{formatted_val}"
            content = re.sub(pattern, replace_func, content, flags=re.MULTILINE)
        
        return content
    
    def _format_nested_value(self, value: Any) -> str:
        """
        格式化嵌套配置的值
        
        Args:
            value: 配置值
            
        Returns:
            格式化后的字符串
        """
        # 处理字符串转数字
        if isinstance(value, str):
            if value.strip() == '':
                return "null"
            else:
                try:
                    return str(int(value))
                except ValueError:
                    return value
        else:
            return str(value)


def create_yaml_handler(target_path: Path) -> YAMLConfigHandler:
    """
    创建 YAML 配置处理器实例
    
    Args:
        target_path: 目标 YAML 文件路径
        
    Returns:
        YAMLConfigHandler 实例
    """
    return YAMLConfigHandler(target_path)