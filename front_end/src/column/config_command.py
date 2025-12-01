#!/usr/bin/env python3
"""
命令配置管理模块
用于管理单卡和多卡命令配置文件
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from ruamel.yaml import YAML

logger = logging.getLogger(__name__)


class CommandConfigHandler:
    """命令配置处理器"""
    
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
            
        # 命令配置文件路径
        self.single_gpu_file = self.project_root / "command_gpu.txt"
        self.multi_gpu_file = self.project_root / "command_gpus.txt"
    
    def load_command_config(self, mode: str = "single") -> Dict[str, Any]:
        """
        加载命令配置
        
        Args:
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            
        Returns:
            配置数据字典
            
        Raises:
            FileNotFoundError: 文件不存在
        """
        if mode == "single":
            config_file = self.single_gpu_file
        elif mode == "multi":
            config_file = self.multi_gpu_file
        else:
            raise ValueError(f"无效的模式: {mode}")
        
        logger.info(f"加载命令配置: {config_file}")
        
        if not config_file.is_file():
            logger.error(f"配置文件不存在: {config_file}")
            raise FileNotFoundError(f"配置文件不存在: {config_file}")
        
        # 解析配置文件
        queues = self._parse_command_file(config_file, mode)
        
        logger.info(f"成功加载 {len(queues)} 个队列配置")
        return {"queues": queues, "mode": mode}
    
    def save_command_config(self, data: Dict[str, Any], mode: str = "single") -> bool:
        """
        保存命令配置
        
        Args:
            data: 配置数据
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            
        Returns:
            是否保存成功
        """
        try:
            if mode == "single":
                config_file = self.single_gpu_file
            elif mode == "multi":
                config_file = self.multi_gpu_file
            else:
                raise ValueError(f"无效的模式: {mode}")
            
            logger.info(f"保存命令配置: {config_file}")
            
            # 备份原文件
            backup_file = config_file.with_suffix('.txt.backup')
            if config_file.exists():
                import shutil
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
    
    def _parse_command_file(self, file_path: Path, mode: str) -> List[Dict[str, Any]]:
        """
        解析命令配置文件
        
        Args:
            file_path: 文件路径
            mode: 模式
            
        Returns:
            队列配置列表（队列下包含多个进程）
        """
        # 使用字典来组织队列和进程
        queues_dict = {}
        current_queue = None
        current_process = None
        
        with file_path.open("r", encoding="utf-8") as f:
            lines = f.readlines()
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            
            # 跳过空行和注释行
            if not line or line.startswith("#"):
                continue
            
            # 解析队列ID行
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
            # 解析命令行
            elif line.startswith('"') and line.endswith('"'):
                if current_queue:
                    command = line[1:-1]  # 去掉引号
                    current_queue["commands"].append(command)
            # 解析GPU数量（仅多卡模式）
            elif mode == "multi" and current_queue and current_queue["gpu_count"] is None:
                try:
                    gpu_count = int(line.split()[0])
                    current_queue["gpu_count"] = gpu_count
                except ValueError:
                    logger.warning(f"第 {line_num} 行：无效的GPU数量: {line}")
                    continue
            # 解析显存需求
            elif current_queue and current_queue["memory"] is None:
                try:
                    memory = int(line.split()[0])
                    current_queue["memory"] = memory
                    
                    # 将当前进程添加到队列中
                    process_data = {
                        "id": len(queues_dict[current_queue["id"]]["processes"]) + 1,
                        "commands": current_queue["commands"],
                        "gpu_count": current_queue["gpu_count"],
                        "memory": current_queue["memory"]
                    }
                    queues_dict[current_queue["id"]]["processes"].append(process_data)
                    
                    current_queue = None
                except ValueError:
                    logger.warning(f"第 {line_num} 行：无效的显存需求: {line}")
                    continue
        
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
                
                # 添加命令
                for command in process.get("commands", []):
                    lines.append(f'"{command}"')
                
                # 多卡模式添加GPU数量
                if mode == "multi":
                    lines.append(str(process.get("gpu_count", 1)))
                
                # 添加显存需求
                lines.append(str(process.get("memory", 20)))
                
                # 添加空行分隔（最后一个进程不加）
                if i < len(processes) - 1:
                    lines.append("")
            
            # 队列间添加空行分隔
            lines.append("")
        
        return "\n".join(lines)
    
    def reset_command_config(self, mode: str = "single") -> bool:
        """
        重置命令配置到备份文件
        
        Args:
            mode: 模式，"single" 表示单卡，"multi" 表示多卡
            
        Returns:
            是否重置成功
        """
        try:
            if mode == "single":
                config_file = self.single_gpu_file
                backup_file = self.single_gpu_file.with_suffix('.txt.backup')
            elif mode == "multi":
                config_file = self.multi_gpu_file
                backup_file = self.multi_gpu_file.with_suffix('.txt.backup')
            else:
                raise ValueError(f"无效的模式: {mode}")
            
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