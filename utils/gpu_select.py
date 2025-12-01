"""
GPU Select - GPU 选择策略模块
根据显存利用率和显存状态选择最优GPU

选择策略：
- 节省显存模式（memory_save_mode=True）：
  显存利用率*剩余显存 越小，优先级越高
  如果相等，那么剩余显存越小，优先级越高
  
- 防止显存溢出模式（memory_save_mode=False）：
  显存利用率*当前占用显存 越小，优先级越高
  如果相等，那么当前占用显存越小，优先级越高
"""

import time
import subprocess
import logging
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass


@dataclass
class GPUStats:
    """GPU 统计信息"""
    gpu_id: int
    memory_free: float      # 剩余显存 (GB)
    memory_used: float      # 已用显存 (GB)
    memory_total: float     # 总显存 (GB)
    utilization: float      # GPU 利用率 (0-100)
    
    @property
    def memory_utilization(self) -> float:
        """显存利用率 (0-1)"""
        if self.memory_total > 0:
            return self.memory_used / self.memory_total
        return 0.0


class GPUSelector:
    """GPU 选择器
    
    根据配置的策略选择最优GPU
    支持高频采样取平均值以获得更稳定的结果
    """
    
    def __init__(self, memory_save_mode: bool = True):
        """初始化
        
        Args:
            memory_save_mode: True=节省显存模式, False=防止显存溢出模式
        """
        self.memory_save_mode = memory_save_mode
    
    @staticmethod
    def get_gpu_stats(gpu_id: int) -> Optional[GPUStats]:
        """获取单个GPU的统计信息
        
        Args:
            gpu_id: GPU ID
            
        Returns:
            GPUStats 对象，失败返回 None
        """
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-gpu=memory.free,memory.used,memory.total,utilization.gpu',
                 '--format=csv,noheader,nounits', f'--id={gpu_id}'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                parts = result.stdout.strip().split(',')
                if len(parts) >= 4:
                    return GPUStats(
                        gpu_id=gpu_id,
                        memory_free=float(parts[0].strip()) / 1024,  # MB -> GB
                        memory_used=float(parts[1].strip()) / 1024,  # MB -> GB
                        memory_total=float(parts[2].strip()) / 1024,  # MB -> GB
                        utilization=float(parts[3].strip())  # 0-100
                    )
        except Exception as e:
            logging.debug(f"Failed to get stats for GPU {gpu_id}: {e}")
        return None
    
    @staticmethod
    def get_all_gpu_stats(gpu_ids: List[int]) -> Dict[int, GPUStats]:
        """获取多个GPU的统计信息
        
        Args:
            gpu_ids: GPU ID 列表
            
        Returns:
            {gpu_id: GPUStats} 字典
        """
        stats = {}
        for gpu_id in gpu_ids:
            gpu_stats = GPUSelector.get_gpu_stats(gpu_id)
            if gpu_stats:
                stats[gpu_id] = gpu_stats
        return stats
    
    def sample_gpu_stats(self, gpu_ids: List[int], 
                         sample_count: int = 30, 
                         sample_interval: float = 0.1) -> Dict[int, GPUStats]:
        """高频采样GPU统计信息并取平均值
        
        在3秒内采样30次（每0.1秒采样一次），取平均值
        
        Args:
            gpu_ids: GPU ID 列表
            sample_count: 采样次数，默认30次
            sample_interval: 采样间隔（秒），默认0.1秒
            
        Returns:
            {gpu_id: GPUStats} 字典，值为平均统计信息
        """
        if not gpu_ids:
            return {}
        
        # 存储所有采样数据
        samples: Dict[int, List[GPUStats]] = {gpu_id: [] for gpu_id in gpu_ids}
        
        logging.info(f"🔍 开始GPU采样: {sample_count}次, 间隔{sample_interval}秒, 总时长{sample_count * sample_interval:.1f}秒")
        
        for i in range(sample_count):
            for gpu_id in gpu_ids:
                stats = self.get_gpu_stats(gpu_id)
                if stats:
                    samples[gpu_id].append(stats)
            
            # 最后一次不需要等待
            if i < sample_count - 1:
                time.sleep(sample_interval)
        
        # 计算平均值
        avg_stats = {}
        for gpu_id, stats_list in samples.items():
            if not stats_list:
                continue
            
            n = len(stats_list)
            avg_stats[gpu_id] = GPUStats(
                gpu_id=gpu_id,
                memory_free=sum(s.memory_free for s in stats_list) / n,
                memory_used=sum(s.memory_used for s in stats_list) / n,
                memory_total=stats_list[0].memory_total,  # 总显存不变
                utilization=sum(s.utilization for s in stats_list) / n
            )
            
            logging.debug(f"GPU {gpu_id} 平均值: free={avg_stats[gpu_id].memory_free:.2f}GB, "
                         f"used={avg_stats[gpu_id].memory_used:.2f}GB, "
                         f"util={avg_stats[gpu_id].utilization:.1f}%")
        
        return avg_stats
    
    def calculate_priority(self, stats: GPUStats) -> Tuple[float, float]:
        """计算GPU优先级分数
        
        Args:
            stats: GPU统计信息
            
        Returns:
            (主优先级分数, 次优先级分数)
            分数越小，优先级越高
        """
        # 显存利用率 (0-1)
        mem_util = stats.memory_utilization
        
        if self.memory_save_mode:
            # 节省显存模式：显存利用率*剩余显存 越小，优先级越高
            # 如果相等，那么剩余显存越小，优先级越高
            primary_score = mem_util * stats.memory_free
            secondary_score = stats.memory_free
        else:
            # 防止显存溢出模式：显存利用率*当前占用显存 越小，优先级越高
            # 如果相等，那么当前占用显存越小，优先级越高
            primary_score = mem_util * stats.memory_used
            secondary_score = stats.memory_used
        
        return (primary_score, secondary_score)
    
    def select_best_gpu(self, gpu_ids: List[int], 
                        required_memory: float = 0,
                        use_sampling: bool = True,
                        sample_count: int = 30,
                        sample_interval: float = 0.1) -> Optional[int]:
        """选择最优GPU
        
        Args:
            gpu_ids: 候选GPU ID列表
            required_memory: 需要的显存 (GB)，用于过滤显存不足的GPU
            use_sampling: 是否使用高频采样
            sample_count: 采样次数
            sample_interval: 采样间隔（秒）
            
        Returns:
            最优GPU ID，如果没有可用GPU返回None
        """
        if not gpu_ids:
            return None
        
        # 获取GPU统计信息
        if use_sampling:
            stats_dict = self.sample_gpu_stats(gpu_ids, sample_count, sample_interval)
        else:
            stats_dict = self.get_all_gpu_stats(gpu_ids)
        
        if not stats_dict:
            logging.warning("无法获取任何GPU的统计信息")
            return None
        
        # 过滤显存不足的GPU
        valid_gpus = []
        for gpu_id, stats in stats_dict.items():
            if stats.memory_free >= required_memory:
                valid_gpus.append((gpu_id, stats))
            else:
                logging.debug(f"GPU {gpu_id} 显存不足: {stats.memory_free:.2f}GB < {required_memory}GB")
        
        if not valid_gpus:
            logging.warning(f"没有GPU满足显存需求 {required_memory}GB")
            return None
        
        # 计算优先级并排序
        scored_gpus = []
        for gpu_id, stats in valid_gpus:
            primary, secondary = self.calculate_priority(stats)
            scored_gpus.append((gpu_id, stats, primary, secondary))
            
            mode_name = "节省显存" if self.memory_save_mode else "防止溢出"
            logging.info(f"GPU {gpu_id} [{mode_name}模式]: "
                        f"free={stats.memory_free:.2f}GB, used={stats.memory_used:.2f}GB, "
                        f"util={stats.utilization:.1f}%, mem_util={stats.memory_utilization:.2%}, "
                        f"score=({primary:.4f}, {secondary:.4f})")
        
        # 按优先级排序（分数越小越优先）
        scored_gpus.sort(key=lambda x: (x[2], x[3]))
        
        best_gpu_id = scored_gpus[0][0]
        best_stats = scored_gpus[0][1]
        
        logging.info(f"✅ 选择GPU {best_gpu_id}: free={best_stats.memory_free:.2f}GB, "
                    f"util={best_stats.utilization:.1f}%")
        
        return best_gpu_id
    
    def select_best_gpus(self, gpu_ids: List[int],
                         count: int,
                         required_memory: float = 0,
                         use_sampling: bool = True,
                         sample_count: int = 30,
                         sample_interval: float = 0.1) -> List[int]:
        """选择多个最优GPU
        
        Args:
            gpu_ids: 候选GPU ID列表
            count: 需要选择的GPU数量
            required_memory: 每个GPU需要的显存 (GB)
            use_sampling: 是否使用高频采样
            sample_count: 采样次数
            sample_interval: 采样间隔（秒）
            
        Returns:
            最优GPU ID列表，可能少于请求数量
        """
        if not gpu_ids or count <= 0:
            return []
        
        # 获取GPU统计信息
        if use_sampling:
            stats_dict = self.sample_gpu_stats(gpu_ids, sample_count, sample_interval)
        else:
            stats_dict = self.get_all_gpu_stats(gpu_ids)
        
        if not stats_dict:
            logging.warning("无法获取任何GPU的统计信息")
            return []
        
        # 过滤显存不足的GPU
        valid_gpus = []
        for gpu_id, stats in stats_dict.items():
            if stats.memory_free >= required_memory:
                valid_gpus.append((gpu_id, stats))
            else:
                logging.debug(f"GPU {gpu_id} 显存不足: {stats.memory_free:.2f}GB < {required_memory}GB")
        
        if not valid_gpus:
            logging.warning(f"没有GPU满足显存需求 {required_memory}GB")
            return []
        
        # 计算优先级并排序
        scored_gpus = []
        for gpu_id, stats in valid_gpus:
            primary, secondary = self.calculate_priority(stats)
            scored_gpus.append((gpu_id, stats, primary, secondary))
        
        # 按优先级排序（分数越小越优先）
        scored_gpus.sort(key=lambda x: (x[2], x[3]))
        
        # 选择前count个GPU
        selected = [gpu_id for gpu_id, _, _, _ in scored_gpus[:count]]
        
        if selected:
            logging.info(f"✅ 选择 {len(selected)} 个GPU: {selected}")
        
        return selected


def select_gpu(gpu_ids: List[int], 
               memory_save_mode: bool = True,
               required_memory: float = 0,
               use_sampling: bool = True) -> Optional[int]:
    """便捷函数：选择单个最优GPU
    
    Args:
        gpu_ids: 候选GPU ID列表
        memory_save_mode: True=节省显存模式, False=防止显存溢出模式
        required_memory: 需要的显存 (GB)
        use_sampling: 是否使用高频采样（3秒30次）
        
    Returns:
        最优GPU ID，如果没有可用GPU返回None
    """
    selector = GPUSelector(memory_save_mode=memory_save_mode)
    return selector.select_best_gpu(
        gpu_ids=gpu_ids,
        required_memory=required_memory,
        use_sampling=use_sampling
    )


def select_gpus(gpu_ids: List[int],
                count: int,
                memory_save_mode: bool = True,
                required_memory: float = 0,
                use_sampling: bool = True) -> List[int]:
    """便捷函数：选择多个最优GPU
    
    Args:
        gpu_ids: 候选GPU ID列表
        count: 需要选择的GPU数量
        memory_save_mode: True=节省显存模式, False=防止显存溢出模式
        required_memory: 每个GPU需要的显存 (GB)
        use_sampling: 是否使用高频采样（3秒30次）
        
    Returns:
        最优GPU ID列表
    """
    selector = GPUSelector(memory_save_mode=memory_save_mode)
    return selector.select_best_gpus(
        gpu_ids=gpu_ids,
        count=count,
        required_memory=required_memory,
        use_sampling=use_sampling
    )
