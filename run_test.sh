#!/bin/bash

# GPU 调度器测试脚本
# 测试队内串行、队间并行功能

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "GPU 调度器功能测试"
echo "=========================================="
echo ""

# 确保日志目录存在
mkdir -p logs

# 清理旧日志
echo "📝 清理旧日志..."
rm -f logs/compete_gpu*.log logs/compete_gpus*.log

echo ""
echo "=========================================="
echo "测试1: 单GPU模式（main_gpu.py）"
echo "=========================================="
echo "预期行为："
echo "  - 队列1: 任务1 → 任务2 (串行)"
echo "  - 队列2: 任务1 → 任务2 (串行)"
echo "  - 队列3: 任务1 (单个任务)"
echo "  - 不同队列并行执行"
echo ""

echo "🚀 启动 main_gpu.py..."
python app/main_gpu.py --command-file command/command_gpu.txt --config-file config/gpu_manage.yaml

echo ""
echo "✅ 单GPU模式测试完成"
echo ""

# 等待一下，确保GPU释放
sleep 5

echo "=========================================="
echo "测试2: 多GPU模式（main_gpus.py）"
echo "=========================================="
echo "预期行为："
echo "  - 队列1: 任务1 → 任务2 (串行)"
echo "  - 队列2: 任务1 → 任务2 (串行)"
echo "  - 队列3: 任务1 (单个任务)"
echo "  - 不同队列并行执行"
echo ""

echo "🚀 启动 main_gpus.py..."
python app/main_gpus.py --command-file command/command_gpus.txt --config-file config/gpu_manage.yaml

echo ""
echo "✅ 多GPU模式测试完成"
echo ""

echo "=========================================="
echo "📊 测试结果分析"
echo "=========================================="
echo ""

# 分析单GPU模式日志
echo "📋 单GPU模式日志分析："
LATEST_GPU_LOG=$(ls -t logs/compete_gpu*.log 2>/dev/null | head -1)
if [ -f "$LATEST_GPU_LOG" ]; then
    echo "   日志文件: $LATEST_GPU_LOG"
    echo ""
    echo "   关键事件:"
    grep -E "Queue|Starting|completed|failed" "$LATEST_GPU_LOG" | head -20
    echo ""
    echo "   最终状态:"
    grep "Tasks:" "$LATEST_GPU_LOG" | tail -1
else
    echo "   ❌ 未找到日志文件"
fi

echo ""

# 分析多GPU模式日志
echo "📋 多GPU模式日志分析："
LATEST_GPUS_LOG=$(ls -t logs/compete_gpus*.log 2>/dev/null | head -1)
if [ -f "$LATEST_GPUS_LOG" ]; then
    echo "   日志文件: $LATEST_GPUS_LOG"
    echo ""
    echo "   关键事件:"
    grep -E "Queue|Starting|completed|failed" "$LATEST_GPUS_LOG" | head -20
    echo ""
    echo "   最终状态:"
    grep "Tasks:" "$LATEST_GPUS_LOG" | tail -1
else
    echo "   ❌ 未找到日志文件"
fi

echo ""
echo "=========================================="
echo "✅ 所有测试完成！"
echo "=========================================="
echo ""
echo "📁 日志位置: $SCRIPT_DIR/logs/"
echo "📊 查看详细日志: tail -f logs/compete_gpu.log"
