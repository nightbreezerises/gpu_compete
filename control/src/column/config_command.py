#!/usr/bin/env python3
"""
命令配置管理模块
用于管理单卡和多卡命令配置文件

支持多配置文件：
- 配置1: command_gpu.txt / command_gpus.txt
- 配置2: command_gpu_1.txt / command_gpus_1.txt
- 配置3: command_gpu_2.txt / command_gpus_2.txt
- ...
"""

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from ruamel.yaml import YAML

logger = logging.getLogger(__name__)


class CommandConfigHandler:
    """命令配置处理器 - 支持多配置文件"""
    
    def __init__(self, project_root: Path = None):
        """
        初始化命令配置处理器
        
        Args:
            project_root: 项目根目录，默认为 src/../..
        """
        if project_root is None:
            self.project_root = Path(__file__).parent.parent.parent.parent
        else:
            self.project_root = project_root
            
        # 命令配置文件目录
        self.command_dir = self.project_root / "command"
    
    def _get_config_file_path(self, mode: str, config_index: int = 0) -> Path:
        """
        获取配置文件路径
        
        Args:
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            config_index: 配置索引，0表示第一个配置
            
        Returns:
            配置文件路径
        """
        if mode == "single":
            base_name = "command_gpu"
        elif mode == "multi":
            base_name = "command_gpus"
        else:
            raise ValueError(f"无效的模式: {mode}")
        
        if config_index == 0:
            return self.command_dir / f"{base_name}.txt"
        else:
            return self.command_dir / f"{base_name}_{config_index}.txt"
    
    def list_configs(self, mode: str = "single") -> List[Dict[str, Any]]:
        """
        列出所有配置文件
        
        Args:
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            
        Returns:
            配置列表，每个元素包含 index, name, file_path, exists
        """
        configs = []
        
        if mode == "single":
            base_name = "command_gpu"
            pattern = re.compile(r"command_gpu(?:_(\d+))?\.txt$")
        else:
            base_name = "command_gpus"
            pattern = re.compile(r"command_gpus(?:_(\d+))?\.txt$")
        
        # 扫描目录中的配置文件
        if self.command_dir.exists():
            for file_path in sorted(self.command_dir.glob(f"{base_name}*.txt")):
                # 排除备份文件
                if file_path.name.endswith('.backup'):
                    continue
                    
                match = pattern.match(file_path.name)
                if match:
                    suffix = match.group(1)
                    if suffix is None:
                        index = 0
                        name = "配置 1"
                    else:
                        index = int(suffix)
                        name = f"配置 {index + 1}"
                    
                    configs.append({
                        "index": index,
                        "name": name,
                        "file_path": str(file_path),
                        "file_name": file_path.name,
                        "exists": file_path.exists()
                    })
        
        # 如果没有找到任何配置，添加默认配置
        if not configs:
            default_path = self._get_config_file_path(mode, 0)
            configs.append({
                "index": 0,
                "name": "配置 1",
                "file_path": str(default_path),
                "file_name": default_path.name,
                "exists": default_path.exists()
            })
        
        # 按索引排序
        configs.sort(key=lambda x: x["index"])
        
        return configs
    
    def load_all_configs(self, mode: str = "single") -> Dict[str, Any]:
        """
        加载所有配置
        
        Args:
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            
        Returns:
            包含所有配置的字典
        """
        configs = self.list_configs(mode)
        result = {
            "mode": mode,
            "configs": []
        }
        
        for config_info in configs:
            config_data = {
                "index": config_info["index"],
                "name": config_info["name"],
                "file_name": config_info["file_name"],
                "queues": []
            }
            
            if config_info["exists"]:
                try:
                    file_path = Path(config_info["file_path"])
                    queues = self._parse_command_file(file_path, mode)
                    config_data["queues"] = queues
                except Exception as e:
                    logger.error(f"加载配置 {config_info['name']} 失败: {e}")
            
            result["configs"].append(config_data)
        
        return result
    
    def load_command_config(self, mode: str = "single", config_index: int = 0) -> Dict[str, Any]:
        """
        加载指定配置
        
        Args:
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            config_index: 配置索引
            
        Returns:
            配置数据字典
        """
        config_file = self._get_config_file_path(mode, config_index)
        
        logger.info(f"加载命令配置: {config_file}")
        
        if not config_file.is_file():
            logger.warning(f"配置文件不存在: {config_file}，返回空配置")
            return {
                "queues": [],
                "mode": mode,
                "config_index": config_index,
                "config_name": f"配置 {config_index + 1}"
            }
        
        # 解析配置文件
        queues = self._parse_command_file(config_file, mode)
        
        logger.info(f"成功加载 {len(queues)} 个队列配置")
        return {
            "queues": queues,
            "mode": mode,
            "config_index": config_index,
            "config_name": f"配置 {config_index + 1}"
        }
    
    def save_command_config(self, data: Dict[str, Any], mode: str = "single", config_index: int = 0) -> bool:
        """
        保存命令配置
        
        Args:
            data: 配置数据
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            config_index: 配置索引
            
        Returns:
            是否保存成功
        """
        try:
            config_file = self._get_config_file_path(mode, config_index)
            
            logger.info(f"保存命令配置: {config_file}")
            
            # 确保目录存在
            config_file.parent.mkdir(parents=True, exist_ok=True)
            
            # 备份原文件
            if config_file.exists():
                import shutil
                backup_file = config_file.parent / (config_file.stem + '.txt.backup')
                shutil.copy2(config_file, backup_file)
                logger.info(f"已备份原配置文件到: {backup_file}")
            
            # 生成配置文件内容
            content = self._generate_file_content(data.get("queues", []), mode)
            
            # 保存文件
            with config_file.open("w", encoding="utf-8") as f:
                f.write(content)
            
            logger.info("命令配置保存成功")
            return True
            
        except Exception as e:
            logger.error(f"保存命令配置失败: {e}")
            return False
    
    def create_new_config(self, mode: str = "single") -> Dict[str, Any]:
        """
        创建新配置
        
        Args:
            mode: 模式
            
        Returns:
            新配置信息
        """
        configs = self.list_configs(mode)
        
        # 找到下一个可用的索引
        existing_indices = {c["index"] for c in configs}
        new_index = 0
        while new_index in existing_indices:
            new_index += 1
        
        # 创建空配置文件
        config_file = self._get_config_file_path(mode, new_index)
        content = self._generate_file_content([], mode)
        
        config_file.parent.mkdir(parents=True, exist_ok=True)
        with config_file.open("w", encoding="utf-8") as f:
            f.write(content)
        
        return {
            "index": new_index,
            "name": f"配置 {new_index + 1}",
            "file_path": str(config_file),
            "file_name": config_file.name
        }
    
    def delete_config(self, mode: str, config_index: int) -> bool:
        """
        删除配置
        
        Args:
            mode: 模式
            config_index: 配置索引
            
        Returns:
            是否删除成功
        """
        if config_index == 0:
            logger.error("不能删除第一个配置")
            return False
        
        config_file = self._get_config_file_path(mode, config_index)
        
        if config_file.exists():
            config_file.unlink()
            logger.info(f"已删除配置文件: {config_file}")
            return True
        
        return False
    
    def _parse_command_file(self, file_path: Path, mode: str) -> List[Dict[str, Any]]:
        """
        解析命令配置文件
        
        支持两种命令格式：
        1. 带引号: "command arg1 arg2"
        2. 不带引号: command arg1 arg2
        
        Args:
            file_path: 文件路径
            mode: 模式
            
        Returns:
            队列配置列表（队列下包含多个进程）
        """
        # 使用字典来组织队列和进程
        queues_dict = {}
        current_queue = None
        
        with file_path.open("r", encoding="utf-8") as f:
            lines = f.readlines()
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            
            # 跳过空行和注释行
            if not line or line.startswith("#"):
                continue
            
            # 解析队列ID行（当前没有正在解析的任务块）
            if current_queue is None:
                try:
                    queue_id = int(line.split()[0])
                    if queue_id not in queues_dict:
                        queues_dict[queue_id] = {
                            "id": queue_id,
                            "processes": []
                        }
                    current_queue = {
                        "id": queue_id,
                        "commands": [],
                        "gpu_count": 1 if mode == "single" else None,
                        "memory": None
                    }
                except ValueError:
                    logger.warning(f"第 {line_num} 行：无效的队列ID: {line}")
                    continue
            else:
                # 尝试解析为数字（GPU数量或显存需求）
                first_token = line.split()[0]
                try:
                    number = int(first_token)
                    
                    # 多卡模式：先解析GPU数量，再解析显存
                    if mode == "multi" and current_queue["gpu_count"] is None:
                        current_queue["gpu_count"] = number
                    elif current_queue["memory"] is None:
                        # 这是显存需求，任务块结束
                        current_queue["memory"] = number
                        
                        # 将当前进程添加到队列中
                        process_data = {
                            "id": len(queues_dict[current_queue["id"]]["processes"]) + 1,
                            "commands": current_queue["commands"],
                            "gpu_count": current_queue["gpu_count"] or 1,
                            "memory": current_queue["memory"]
                        }
                        queues_dict[current_queue["id"]]["processes"].append(process_data)
                        current_queue = None
                    else:
                        # 数字但不是GPU数量也不是显存，当作命令处理
                        current_queue["commands"].append(line)
                except ValueError:
                    # 不是数字，是命令行
                    # 去掉引号（如果有）
                    if line.startswith('"') and line.endswith('"'):
                        command = line[1:-1]
                    else:
                        command = line
                    current_queue["commands"].append(command)
        
        # 转换为列表并按ID排序
        queues = sorted(queues_dict.values(), key=lambda x: x["id"])
        
        total_processes = sum(len(queue["processes"]) for queue in queues)
        logger.info(f"解析完成，共 {len(queues)} 个队列，{total_processes} 个进程")
        return queues
    
    def _generate_file_content(self, queues: List[Dict[str, Any]], mode: str) -> str:
        """
        生成配置文件内容
        
        Args:
            queues: 队列配置列表
            mode: 模式
            
        Returns:
            文件内容字符串
        """
        lines = []
        
        # 添加文件头注释
        if mode == "single":
            lines.extend([
                "# 任务配置文件格式说明：",
                "# 1. 每个任务块以空行分隔",
                "# 2. 第一行：队列ID（数字，可跟注释如 '1 #队列ID'）",
                "# 3. 中间行：命令列表（建议用引号包围，支持变量 {work_dir} 和 {uni_id}）",
                "# 4. 最后一行：显存需求（数字，可跟注释如 '20 #显存'）",
                "# 5. 支持的变量：",
                "#    - {work_dir}: 工作目录（脚本父目录）",
                "#    - {uni_id}: 唯一标识符（自动生成）",
                "#",
                "# 示例任务块：",
                "# 1 #队列ID",
                '# "命令1"',
                '# "命令2"',
                '# "命令3"',
                "# 20 #显存需求",
                "#",
                "# ==================== 任务列表 ====================",
                ""
            ])
        else:  # multi
            lines.extend([
                "# 任务配置文件格式说明：",
                "# 1. 每个任务块以空行分隔",
                "# 2. 第一行：队列ID（数字，可跟注释如 '1 #队列ID'）",
                "# 3. 第二行：命令列表（建议用引号包围，支持变量 {work_dir} 和 {uni_id}）",
                "# 4. 第三行：GPU数量需求（数字，可跟注释如 '1 #GPU数量需求'）",
                "# 5. 最后一行：显存需求（数字，可跟注释如 '20 #显存'）",
                "# 6. 支持的变量：",
                "#    - {work_dir}: 工作目录（脚本父目录）",
                "#    - {uni_id}: 唯一标识符（自动生成）",
                "#",
                "# 示例任务块：",
                "# 1 #队列ID",
                '# "命令1"',
                '# "命令2"',
                '# "命令3"',
                "# 1 #GPU数量需求",
                "# 20 #显存需求",
                "#",
                "# ==================== 任务列表 ====================",
                ""
            ])
        
        # 添加队列配置
        for queue in queues:
            processes = queue.get("processes", [])
            
            for i, process in enumerate(processes):
                # 添加队列ID
                lines.append(str(queue["id"]))
                
                # 添加命令（不使用引号）
                for command in process.get("commands", []):
                    lines.append(command)
                
                # 多卡模式添加GPU数量
                if mode == "multi":
                    lines.append(str(process.get("gpu_count", 1)))
                
                # 添加显存需求
                lines.append(str(process.get("memory", 20)))
                
                # 添加空行分隔
                lines.append("")
        
        return "\n".join(lines)
    
    def reset_command_config(self, mode: str = "single", config_index: int = 0) -> bool:
        """
        重置命令配置到备份文件
        
        Args:
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            config_index: 配置索引
            
        Returns:
            是否重置成功
        """
        try:
            config_file = self._get_config_file_path(mode, config_index)
            backup_file = config_file.parent / (config_file.stem + '.txt.backup')
            
            logger.info(f"重置命令配置: {config_file}")
            
            # 检查备份文件是否存在
            if not backup_file.is_file():
                logger.error(f"备份文件不存在: {backup_file}")
                return False
            
            # 从备份文件恢复
            import shutil
            shutil.copy2(backup_file, config_file)
            
            logger.info(f"命令配置重置成功，从备份文件恢复: {backup_file}")
            return True
            
        except Exception as e:
            logger.error(f"重置命令配置失败: {e}")
            return False

    def validate_command_config(self, data: Dict[str, Any], mode: str) -> Dict[str, str]:
        """
        验证命令配置数据
        
        Args:
            data: 配置数据
            mode: 模式
            
        Returns:
            验证错误字典
        """
        errors = {}
        queues = data.get("queues", [])
        
        if not isinstance(queues, list):
            errors["queues"] = "队列配置必须是数组"
            return errors
        
        # 检查队列ID唯一性
        queue_ids = []
        for i, queue in enumerate(queues):
            if not isinstance(queue, dict):
                errors[f"queues[{i}]"] = "队列配置必须是对象"
                continue
            
            # 检查队列ID
            queue_id = queue.get("id")
            if queue_id is None:
                errors[f"queues[{i}].id"] = "队列ID不能为空"
            elif not isinstance(queue_id, int) or queue_id <= 0:
                errors[f"queues[{i}].id"] = "队列ID必须是正整数"
            elif queue_id in queue_ids:
                errors[f"queues[{i}].id"] = f"队列ID {queue_id} 重复"
            else:
                queue_ids.append(queue_id)
            
            # 检查进程列表
            processes = queue.get("processes", [])
            if not isinstance(processes, list):
                errors[f"queues[{i}].processes"] = "进程列表必须是数组"
            elif not processes:
                errors[f"queues[{i}].processes"] = "进程列表不能为空"
            else:
                for j, process in enumerate(processes):
                    if not isinstance(process, dict):
                        errors[f"queues[{i}].processes[{j}]"] = "进程配置必须是对象"
                        continue
                    
                    # 检查命令列表
                    commands = process.get("commands", [])
                    if not isinstance(commands, list):
                        errors[f"queues[{i}].processes[{j}].commands"] = "命令列表必须是数组"
                    elif not commands:
                        errors[f"queues[{i}].processes[{j}].commands"] = "命令列表不能为空"
                    else:
                        for k, command in enumerate(commands):
                            if not isinstance(command, str) or not command.strip():
                                errors[f"queues[{i}].processes[{j}].commands[{k}]"] = "命令不能为空"
                    
                    # 检查显存需求
                    memory = process.get("memory")
                    if memory is None:
                        errors[f"queues[{i}].processes[{j}].memory"] = "显存需求不能为空"
                    elif not isinstance(memory, int) or memory <= 0:
                        errors[f"queues[{i}].processes[{j}].memory"] = "显存需求必须是正整数"
                    
                    # 多卡模式检查GPU数量
                    if mode == "multi":
                        gpu_count = process.get("gpu_count")
                        if gpu_count is None:
                            errors[f"queues[{i}].processes[{j}].gpu_count"] = "GPU数量不能为空"
                        elif not isinstance(gpu_count, int) or gpu_count <= 0:
                            errors[f"queues[{i}].processes[{j}].gpu_count"] = "GPU数量必须是正整数"
        
        return errors


# 创建默认实例
def create_command_handler(project_root: Path = None) -> CommandConfigHandler:
    """
    创建命令配置处理器实例
    
    Args:
        project_root: 项目根目录
        
    Returns:
        命令配置处理器实例
    """
    return CommandConfigHandler(project_root)


# 导出的函数
__all__ = [
    'CommandConfigHandler',
    'create_command_handler'
]