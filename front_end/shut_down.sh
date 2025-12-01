#!/bin/bash

# GPU 竞争调度器配置编辑器关闭脚本
# 
# 选项:
#   --count N          关闭 N 个实例
#   --status           显示所有实例状态
#   --help             显示帮助信息

set -e

# 默认选项
TARGET_COUNT=-1  # -1 表示关闭所有
SHOW_STATUS=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --count)
            if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                TARGET_COUNT=$2
                shift 2
            else
                echo "❌ 错误: --count 需要一个数字参数"
                echo "用法: $0 --count N"
                exit 1
            fi
            ;;
        --status)
            SHOW_STATUS=true
            shift
            ;;
        --help)
            echo "GPU 竞争调度器配置编辑器关闭脚本"
            echo ""
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --count N          关闭 N 个实例"
            echo "  --status           显示所有实例状态"
            echo "  --help             显示此帮助信息"
            echo ""
            echo "示例:"
            echo "  $0                  # 关闭所有实例"
            echo "  $0 --count 2        # 关闭 2 个实例"
            echo "  $0 --status         # 显示实例状态"
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
if [[ "$TARGET_COUNT" -ne -1 && "$TARGET_COUNT" -lt 1 ]]; then
    echo "❌ 错误: 实例数量必须大于 0"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📍 脚本目录: $SCRIPT_DIR"

# 1. 从 PID 文件读取进程信息
echo ""
echo "🔍 读取进程信息..."
PID_FILE="$SCRIPT_DIR/logs/pid.json"

if [ -f "$PID_FILE" ]; then
    # 使用 Python 读取 pid.json（更可靠）
    if command -v python3 >/dev/null 2>&1; then
        # 显示状态
        if [[ "$SHOW_STATUS" == true ]]; then
            echo "📊 实例状态:"
            echo ""
            python3 -c "
import json
import os

try:
    with open('$PID_FILE', 'r') as f:
        data = json.load(f)
    
    instances = data.get('instances', [])
    if not instances:
        print('   - 未发现实例')
    else:
        print(f'   发现 {len(instances)} 个实例:')
        print('')
        for inst in instances:
            pid = inst.get('pid', 'N/A')
            port = inst.get('port', 'N/A')
            url = inst.get('url', 'N/A')
            instance_num = inst.get('instance', 'N/A')
            start_time = inst.get('start_time', 'N/A')
            
            # 检查进程是否运行
            try:
                os.kill(pid, 0)
                status = '✅ 运行中'
            except:
                status = '❌ 已停止'
            
            print(f'   - 实例 {instance_num}: {url}')
            print(f'     PID: {pid}, 端口: {port}, 状态: {status}')
            print(f'     启动时间: {start_time}')
            print('')
except Exception as e:
    print(f'   - 读取实例信息失败: {e}')
" 2>/dev/null
            exit 0
        fi
        
        # 关闭实例
        echo "   - 发现 PID 文件: $PID_FILE"
        
        python3 -c "
import json
import os
import signal
import time

try:
    with open('$PID_FILE', 'r') as f:
        data = json.load(f)
    
    instances = data.get('instances', [])
    target_count = $TARGET_COUNT
    closed_count = 0
    remaining_instances = []
    
    print(f'   - 发现 {len(instances)} 个实例')
    
    for inst in instances:
        pid = inst.get('pid', 0)
        instance_num = inst.get('instance', 'N/A')
        url = inst.get('url', 'N/A')
        
        if target_count == -1 or closed_count < target_count:
            print(f'   - 实例 {instance_num}: PID {pid}, URL: {url}')
            
            # 检查进程是否运行
            try:
                os.kill(pid, 0)
                print(f'   - 实例 {instance_num}: 进程正在运行，开始停止...')
                os.kill(pid, signal.SIGTERM)
                time.sleep(2)
                
                # 检查是否仍在运行
                try:
                    os.kill(pid, 0)
                    print(f'   - 实例 {instance_num}: 进程仍在运行，强制终止...')
                    os.kill(pid, signal.SIGKILL)
                    time.sleep(1)
                except OSError:
                    pass
                
                # 最终检查
                try:
                    os.kill(pid, 0)
                    print(f'   - 实例 {instance_num}: ❌ 进程停止失败')
                except OSError:
                    print(f'   - 实例 {instance_num}: ✅ 进程已成功停止')
                    closed_count += 1
            except OSError:
                print(f'   - 实例 {instance_num}: 进程不存在或已停止')
                closed_count += 1
        else:
            remaining_instances.append(inst)
    
    # 更新 PID 文件
    if target_count != -1 and remaining_instances:
        # 重新编号
        for i, inst in enumerate(remaining_instances, 1):
            inst['instance'] = i
        with open('$PID_FILE', 'w') as f:
            json.dump({'instances': remaining_instances}, f, indent=2, ensure_ascii=False)
        print(f'   - 更新 PID 文件，保留 {len(remaining_instances)} 个实例')
    else:
        # 删除 PID 文件
        os.remove('$PID_FILE')
        print('   - 删除 PID 文件...')
    
    print(f'   - 共关闭 {closed_count} 个实例')
    
except Exception as e:
    print(f'   - 处理失败: {e}')
" 2>/dev/null
    else
        echo "   - Python3 不可用，使用备用方案..."
        # 备用方案：使用 pkill
        pkill -f "python.*main.py" || true
        rm -f "$PID_FILE"
    fi
else
    echo "   - 未找到 PID 文件，尝试查找进程..."
    
    # 备用方案：查找进程
    PIDS=$(pgrep -f "python.*main.py" 2>/dev/null || true)
    
    if [ -n "$PIDS" ]; then
        echo "   - 发现相关进程: $PIDS"
        for PID in $PIDS; do
            echo "   - 停止进程 $PID..."
            kill "$PID" 2>/dev/null || true
            sleep 2
            if kill -0 "$PID" 2>/dev/null; then
                echo "   - 强制终止进程 $PID..."
                kill -9 "$PID" 2>/dev/null || true
            fi
        done
    else
        echo "   - 未发现相关进程"
    fi
fi

# 2. 显示日志文件信息
echo ""
echo "📋 日志文件信息:"
if [ -f "$SCRIPT_DIR/logs/run.log" ]; then
    echo "   - 日志文件: $SCRIPT_DIR/logs/run.log"
    echo "   - 文件大小: $(du -h "$SCRIPT_DIR/logs/run.log" | cut -f1)"
    echo "   - 最后修改: $(stat -c %y "$SCRIPT_DIR/logs/run.log")"

    echo ""
    echo "   - 查看最后 10 行日志:"
    echo "     tail -n 10 $SCRIPT_DIR/logs/run.log"
    echo ""
    echo "   - 实时查看日志:"
    echo "     tail -f $SCRIPT_DIR/logs/run.log"
else
    echo "   - 未找到日志文件"
fi

# 3. 显示 PID 文件信息（如果存在）
if [ -f "$PID_FILE" ]; then
    echo ""
    echo "📄 PID 文件信息:"
    echo "   - 文件: $PID_FILE"
    echo "   - 内容:"
    cat "$PID_FILE" | sed 's/^/     /'
else
    echo ""
    echo "📄 PID 文件已清理"
fi

echo ""
echo "✅ 关闭完成！"
echo "📍 重新启动: bash $SCRIPT_DIR/run.sh"