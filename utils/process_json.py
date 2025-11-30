"""
Process JSON - 用于管理 uni_id.json 文件
"""

import os
import json
import logging
from typing import Dict, Optional
import psutil


class ProcessJSON:
    """管理 uni_id.json 文件"""
    
    def __init__(self, json_path: str):
        self.json_path = json_path
        self._ensure_exists()
    
    def _ensure_exists(self):
        """确保 JSON 文件存在"""
        os.makedirs(os.path.dirname(self.json_path), exist_ok=True)
        if not os.path.exists(self.json_path):
            with open(self.json_path, 'w') as f:
                json.dump({}, f)
    
    def load(self) -> dict:
        """安全加载 JSON"""
        try:
            with open(self.json_path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {}
                data = json.loads(content)
                return data if isinstance(data, dict) else {}
        except Exception as e:
            logging.warning(f"Failed to load JSON: {e}")
            return {}
    
    def save(self, data: dict):
        """安全保存 JSON"""
        try:
            with open(self.json_path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logging.error(f"Failed to save JSON: {e}")
    
    def get_record(self, uni_id: str) -> Optional[dict]:
        """获取指定 uni_id 的记录"""
        data = self.load()
        return data.get(uni_id)
    
    def update_record(self, uni_id: str, pid: int, state: str, error_type: str = None):
        """更新记录"""
        data = self.load()
        if uni_id not in data:
            data[uni_id] = {'retry_count': 0}
        data[uni_id]['pid'] = pid
        data[uni_id]['state'] = state
        if error_type:
            data[uni_id]['error_type'] = error_type
        elif state == 'normal_exit' and 'error_type' in data[uni_id]:
            del data[uni_id]['error_type']
        self.save(data)
    
    def increment_retry(self, uni_id: str) -> int:
        """增加重试次数并返回新值"""
        data = self.load()
        if uni_id in data:
            data[uni_id]['retry_count'] = data[uni_id].get('retry_count', 0) + 1
            self.save(data)
            return data[uni_id]['retry_count']
        return 0
    
    def get_running_processes(self) -> Dict[str, dict]:
        """获取所有 running 状态的进程"""
        data = self.load()
        return {k: v for k, v in data.items() 
                if isinstance(v, dict) and v.get('state') == 'running'}
    
    def is_process_running(self, uni_id: str) -> bool:
        """检查进程是否真正在运行"""
        record = self.get_record(uni_id)
        if not record or record.get('state') != 'running':
            return False
        pid = record.get('pid', 0)
        if pid <= 0:
            return False
        return psutil.pid_exists(pid)