#!/bin/bash

# GPU 竞争调度器配置编辑器一键部署脚本
# 用于删除前端、重新构建、重启后端
# 
# 选项:
#   --keep-existing    保留现有进程，不停止
#   --multi N          启动 N 个实例（多开模式）
#   --help             显示帮助信息

set -e  # 遇到错误立即退出

# 默认选项
KEEP_EXISTING=false
MULTI_MODE=false
INSTANCE_COUNT=1

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --keep-existing)
            KEEP_EXISTING=true
            shift
            ;;
        --multi)
            MULTI_MODE=true
            if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                INSTANCE_COUNT=$2
                shift 2
            else
                echo "❌ 错误: --multi 需要一个数字参数"
                echo "用法: $0 --multi N"
                exit 1
            fi
            ;;
        --help)
            echo "GPU 竞争调度器配置编辑器部署脚本"
            echo ""
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --keep-existing    保留现有进程，不停止"
            echo "  --multi N          启动 N 个实例（多开模式）"
            echo "  --help             显示此帮助信息"
            echo ""
            echo "示例:"
            echo "  $0                    # 标准启动（停止现有进程）"
            echo "  $0 --keep-existing    # 保留现有进程"
            echo "  $0 --multi 3          # 启动 3 个实例"
            exit 0
            ;;
        *)
            echo "❌ 未知选项: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

# 验证实例数量
if [[ "$INSTANCE_COUNT" -lt 1 || "$INSTANCE_COUNT" -gt 20 ]]; then
    echo "❌ 错误: 实例数量必须在 1-20 之间"
    exit 1
fi

echo "=========================================="
echo "GPU 竞争调度器配置编辑器一键部署脚本"
echo "=========================================="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📍 脚本目录: $SCRIPT_DIR"
echo "📍 项目根目录: $PROJECT_ROOT"

# 1. 删除前端产物
echo ""
echo "🗑️  清理前端产物..."
cd "$SCRIPT_DIR/src/dashboard"

if [ -d "dist" ]; then
    echo "   - 删除 dashboard/dist"
    rm -rf dist
fi

if [ -d "node_modules" ]; then
    echo "   - 删除 dashboard/node_modules"
    rm -rf node_modules
fi

# 2. 重新安装前端依赖
echo ""
echo "📦 安装前端依赖..."
export PATH=$HOME/app/node-local/bin:$PATH
npm install

# 3. 重新构建前端
echo ""
echo "🔨 重新构建前端..."
npm run build

# 4. 停止现有后端服务（如果需要）
if [[ "$KEEP_EXISTING" == false ]]; then
    echo ""
    echo "🛑 停止现有后端服务..."
    pkill -f "python.*main.py" || true
    sleep 2
else
    echo ""
    echo "⚠️  保留现有进程（--keep-existing 模式）"
fi

# 5. 启动后端服务（后台运行）
echo ""
if [[ "$MULTI_MODE" == true ]]; then
    echo "🚀 启动 $INSTANCE_COUNT 个后端服务实例（多开模式）..."
else
    echo "🚀 启动后端服务..."
fi

cd "$SCRIPT_DIR/src"

# 确保日志目录存在
mkdir -p "$SCRIPT_DIR/logs"

# PID 文件路径
PID_FILE="$SCRIPT_DIR/logs/pid.json"
LOG_FILE="$SCRIPT_DIR/logs/run.log"

# 清空旧日志和PID文件
> "$LOG_FILE"
echo '{"instances":[]}' > "$PID_FILE"

# 启动实例（统一输出到 run.log）
PIDS=()
for ((i=1; i<=INSTANCE_COUNT; i++)); do
    echo "   - 启动实例 $i/$INSTANCE_COUNT..."
    
    # 检查虚拟环境
    if [ -f "$PROJECT_ROOT/env/bin/activate" ]; then
        source "$PROJECT_ROOT/env/bin/activate"
    elif [ -f "$PROJECT_ROOT/compete_gpu/bin/activate" ]; then
        source "$PROJECT_ROOT/compete_gpu/bin/activate"
    fi
    
    # 启动进程，所有实例输出到同一个日志文件（追加模式）
    nohup python main.py >> "$LOG_FILE" 2>&1 &
    PID=$!
    PIDS+=($PID)
    
    echo "   - 实例 $i 已启动，PID: $PID"
    sleep 2
done

# 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 3

# 等待 pid.json 写入完成
echo "   - 等待进程注册..."
for ((wait_i=0; wait_i<20; wait_i++)); do
    if [[ -f "$PID_FILE" ]] && grep -q '"url"' "$PID_FILE" 2>/dev/null; then
        echo "   - 进程已注册 (等待 ${wait_i} 次)"
        break
    fi
    sleep 0.5
done

# 验证进程
RUNNING_COUNT=0
for PID in ${PIDS[@]}; do
    if kill -0 $PID 2>/dev/null; then
        RUNNING_COUNT=$((RUNNING_COUNT + 1))
    fi
done

echo "   - 验证进程: 运行中 $RUNNING_COUNT/$INSTANCE_COUNT 个"

if [[ $RUNNING_COUNT -gt 0 ]]; then
    echo "   ✅ 成功启动 $RUNNING_COUNT/$INSTANCE_COUNT 个服务实例"
    echo ""
    echo "=========================================="
    echo "📍 访问地址："
    
    # 直接从 pid.json 读取 url 输出
    if [[ -f "$PID_FILE" ]]; then
        python3 -c "
import json
import sys
try:
    with open('$PID_FILE', 'r') as f:
        data = json.load(f)
    instances = data.get('instances', [])
    if instances:
        for inst in instances:
            print(f\"   - 实例 {inst['instance']}: {inst['url']} (PID: {inst['pid']})\")
    else:
        print('   - 未找到实例信息')
except Exception as e:
    print(f'   - 读取失败: {e}')
    sys.exit(1)
" 2>/dev/null || echo "   - 读取失败，请查看: cat $PID_FILE"
    fi
    
    echo "=========================================="
    echo ""
    echo "💡 提示："
    echo "   - 查看日志: tail -f $LOG_FILE"
    echo "   - 关闭服务: bash shut_down.sh"
else
    echo "   ❌ 服务启动失败，请检查日志: tail -f $LOG_FILE"
    exit 1
fi

echo ""
echo "✅ 部署完成！"