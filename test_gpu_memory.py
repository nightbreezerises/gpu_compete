#!/usr/bin/env python3
"""
GPU 内存占用测试脚本
- 消耗约500MB显存
- 运行约60秒
- 用于测试GPU调度器功能
"""

import torch
import time
import sys
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_gpu_memory(duration_seconds=60, memory_mb=500):
    """
    测试GPU内存占用
    
    Args:
        duration_seconds: 运行时长（秒）
        memory_mb: 显存占用（MB）
    """
    try:
        # 检查CUDA是否可用
        if not torch.cuda.is_available():
            logger.error("❌ CUDA not available")
            return False
        
        device = torch.device('cuda')
        logger.info(f"✅ Using GPU: {torch.cuda.get_device_name(0)}")
        
        # 计算需要分配的张量大小（MB -> 元素数）
        # float32 = 4字节，所以 memory_mb * 1024 * 1024 / 4 = 元素数
        num_elements = (memory_mb * 1024 * 1024) // 4
        
        logger.info(f"🚀 Allocating ~{memory_mb}MB GPU memory...")
        
        # 分配显存
        tensor = torch.randn(num_elements, dtype=torch.float32, device=device)
        
        # 获取实际分配的显存
        torch.cuda.synchronize()
        allocated = torch.cuda.memory_allocated() / (1024 * 1024)
        logger.info(f"✅ Allocated: {allocated:.1f}MB")
        
        # 执行一些计算以保持GPU活跃
        logger.info(f"⏱️ Running for {duration_seconds} seconds...")
        start_time = time.time()
        iteration = 0
        
        while time.time() - start_time < duration_seconds:
            # 执行简单的矩阵运算
            _ = torch.matmul(tensor[:1000], tensor[:1000].T)
            iteration += 1
            
            # 每10秒打印一次进度
            elapsed = time.time() - start_time
            if elapsed % 10 < 1 and iteration % 100 == 0:
                logger.info(f"   Progress: {elapsed:.1f}s / {duration_seconds}s (iteration: {iteration})")
            
            time.sleep(0.1)
        
        logger.info(f"✅ Test completed successfully!")
        logger.info(f"   Total iterations: {iteration}")
        logger.info(f"   Total time: {time.time() - start_time:.1f}s")
        
        # 清理
        del tensor
        torch.cuda.empty_cache()
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # 从命令行参数读取配置
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    memory = int(sys.argv[2]) if len(sys.argv) > 2 else 500
    
    logger.info(f"GPU Memory Test: duration={duration}s, memory={memory}MB")
    
    success = test_gpu_memory(duration_seconds=duration, memory_mb=memory)
    sys.exit(0 if success else 1)
