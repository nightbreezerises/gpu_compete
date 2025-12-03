#!/bin/bash
# ------------------------------------------------------------------
# 脚本功能：
#   1. 自动获取当前脚本所在目录
#   2. 使用绝对路径调用 control/shut_down.sh
#   3. 检查文件是否存在
#   4. 确保脚本可执行
#   5. 捕获执行返回码，并在失败时退出脚本
# ------------------------------------------------------------------

# 获取当前脚本所在目录的绝对路径
# BASH_SOURCE[0] 返回当前脚本的路径
# dirname 获取路径的目录部分
# cd ... && pwd 转换为绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# shut_down.sh 的绝对路径
SHUTDOWN_SCRIPT="${SCRIPT_DIR}/control/shut_down.sh"

# ------------------------------------------------------------------
# 检查 shut_down.sh 是否存在
# ------------------------------------------------------------------
if [ ! -f "$SHUTDOWN_SCRIPT" ]; then
    echo "Error: $SHUTDOWN_SCRIPT not found!"
    exit 1
fi

# ------------------------------------------------------------------
# 确保 shut_down.sh 可执行
# ------------------------------------------------------------------
chmod +x "$SHUTDOWN_SCRIPT"

# ------------------------------------------------------------------
# 执行 shut_down.sh 并捕获返回码
# ------------------------------------------------------------------
bash "$SHUTDOWN_SCRIPT"
RETVAL=$?

# 如果执行失败，则输出错误信息并退出
if [ $RETVAL -ne 0 ]; then
    echo "Error: $SHUTDOWN_SCRIPT exited with code $RETVAL"
    exit $RETVAL
fi

echo "shut_down.sh executed successfully."
