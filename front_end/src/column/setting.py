#!/usr/bin/env python3
"""
系统设置模块
用于管理 front_end/config.yaml 配置文件
"""

import logging
from pathlib import Path
from typing import Any, Dict
from ruamel.yaml import YAML

logger = logging.getLogger(__name__)


class SystemSettingsHandler:
    """系统设置处理器"""
    
    def __init__(self, config_path: Path = None):
        """
        初始化设置处理器
        
        Args:
            config_path: config.yaml 文件路径，默认为 src/../config.yaml
        """
        if config_path is None:
            # 默认路径：front_end 目录下的 config.yaml
            self.config_path = Path(__file__).parent.parent.parent / "config.yaml"
        else:
            self.config_path = config_path
            
        self.ryaml = YAML()
        self.ryaml.preserve_quotes = True
        self.ryaml.width = 4096
        self.ryaml.default_flow_style = False
        self.ryaml.map_indent = 2
        self.ryaml.sequence_indent = 4
        self.ryaml.sequence_dash_offset = 2
    
    def load_settings(self) -> Dict[str, Any]:
        """
        读取系统设置
        
        Returns:
            设置数据字典
            
        Raises:
            FileNotFoundError: 文件不存在
        """
        logger.info(f"读取系统设置: {self.config_path}")
        if not self.config_path.is_file():
            logger.error(f"配置文件不存在: {self.config_path}")
            raise FileNotFoundError(f"配置文件不存在: {self.config_path}")
        
        with self.config_path.open("r", encoding="utf-8") as f:
            data = self.ryaml.load(f) or {}
        
        logger.info(f"成功读取设置，包含 {len(data)} 个顶级键")
        return data
    
    def save_settings(self, data: Dict[str, Any]) -> bool:
        """
        保存系统设置
        
        Args:
            data: 设置数据字典
            
        Returns:
            是否保存成功
        """
        try:
            logger.info(f"保存系统设置: {self.config_path}")
            
            # 备份原文件
            backup_path = self.config_path.with_suffix('.yaml.backup')
            if self.config_path.exists():
                import shutil
                shutil.copy2(self.config_path, backup_path)
                logger.info(f"已备份原配置文件到: {backup_path}")
            
            # 读取原文件以保留注释
            with self.config_path.open("r", encoding="utf-8") as f:
                original_data = self.ryaml.load(f) or {}
            
            # 更新数据，保留原有的注释
            for key, value in data.items():
                original_data[key] = value
            
            # 保存配置（保留注释）
            with self.config_path.open("w", encoding="utf-8") as f:
                self.ryaml.dump(original_data, f)
            
            logger.info("系统设置保存成功")
            return True
            
        except Exception as e:
            logger.error(f"保存系统设置失败: {e}")
            return False
    
    def validate_settings(self, data: Dict[str, Any]) -> Dict[str, str]:
        """
        验证设置数据
        
        Args:
            data: 设置数据字典
            
        Returns:
            验证错误字典，空字典表示验证通过
        """
        errors = {}
        
        # 验证端口
        port = data.get('port')
        if port is not None:
            if not isinstance(port, int) or port < 1 or port > 65535:
                errors['port'] = "端口必须是 1-65535 之间的整数"
        
        # 验证绑定地址
        bind_address = data.get('bind-address')
        if bind_address is not None:
            valid_addresses = ['0.0.0.0', '127.0.0.1', 'localhost']
            if bind_address not in valid_addresses and not self._is_valid_ip(bind_address):
                errors['bind-address'] = "无效的绑定地址"
        
                
        # 验证布尔值
        bool_fields = ['allow-lan']
        for field in bool_fields:
            if field in data and not isinstance(data[field], bool):
                errors[field] = f"{field} 必须是布尔值"
        
        return errors
    
    def _is_valid_ip(self, ip: str) -> bool:
        """验证 IP 地址格式"""
        try:
            parts = ip.split('.')
            if len(parts) != 4:
                return False
            for part in parts:
                num = int(part)
                if num < 0 or num > 255:
                    return False
            return True
        except ValueError:
            return False
    
    def get_setting_info(self, key: str) -> Dict[str, Any]:
        """
        获取特定设置项的信息
        
        Args:
            key: 设置项键名
            
        Returns:
            设置项信息字典
        """
        info = {
            'key': key,
            'requires_restart': False,
            'warning': None,
            'description': None
        }
        
        # 需要重启的设置项
        restart_required = ['port', 'bind-address']
        if key in restart_required:
            info['requires_restart'] = True
        
        # 警告信息
        warnings = {
            'port': "修改端口后，下次启动可能使用新端口",
            'bind-address': "修改绑定地址后，下次启动可能使用新地址"
        }
        info['warning'] = warnings.get(key)
        
        # 描述信息
        descriptions = {
            'target-yaml-path': "要操作的 YAML 文件路径（支持绝对路径和相对路径）",
            'log-dir': "日志存储目录",
            'port': "当前任务运行端口（如果冲突了自动换一个）",
            'allow-lan': "允许来自局域网外部主机的访问",
            'bind-address': "服务绑定地址",
            'log-level': "日志级别",
            'secret': "访问密钥（用于 API 认证）"
        }
        info['description'] = descriptions.get(key)
        
        return info


# 创建默认实例
def create_settings_handler(config_path: Path = None) -> SystemSettingsHandler:
    """
    创建设置处理器实例
    
    Args:
        config_path: 配置文件路径
        
    Returns:
        设置处理器实例
    """
    return SystemSettingsHandler(config_path)


# 导出的函数
__all__ = [
    'SystemSettingsHandler',
    'create_settings_handler'
]