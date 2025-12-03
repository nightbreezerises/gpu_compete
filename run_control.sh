#!/bin/bash
# ------------------------------------------------------------------
# 脚本功能：
#   1. 自动获取当前脚本所在目录
#   2. 检查系统是否安装 npm，如果未安装则执行 config.sh 进行配置
#   3. 确保 run.sh 可执行并执行它
# ------------------------------------------------------------------

# 获取当前脚本所在目录的绝对路径
# BASH_SOURCE[0] 返回当前脚本的路径（即使被 source 调用）
# dirname 获取路径的目录部分
# cd ... && pwd 将其转换为绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# ------------------------------------------------------------------
# 检查 npm 是否存在
# command -v npm 会返回 npm 的路径，如果未找到，则返回非零
# ! 表示取反，即当 npm 不存在时执行 if 语句块
# ------------------------------------------------------------------
if ! command -v npm &> /dev/null; then
    echo "npm not found, running config.sh..."  # 提示用户 npm 未安装，将运行配置脚本

    # 检查 config.sh 文件是否存在
    if [ -f "${SCRIPT_DIR}/control/config.sh" ]; then
        chmod +x "${SCRIPT_DIR}/control/config.sh"  # 确保脚本有可执行权限
        bash "${SCRIPT_DIR}/control/config.sh"      # 执行 config.sh
    else
        # 如果 config.sh 不存在，则输出错误信息并退出脚本
        echo "Error: ${SCRIPT_DIR}/control/config.sh not found!"
        exit 1
    fi
fi

# ------------------------------------------------------------------
# 执行 run.sh
# 1. 先检查文件是否存在
# 2. 确保文件可执行
# 3. 执行 run.sh
# ------------------------------------------------------------------
if [ -f "${SCRIPT_DIR}/control/run.sh" ]; then
    chmod +x "${SCRIPT_DIR}/control/run.sh"  # 确保 run.sh 可执行
    bash "${SCRIPT_DIR}/control/run.sh"      # 执行 run.sh
else
    # 如果 run.sh 不存在，则输出错误信息并退出脚本
    echo "Error: ${SCRIPT_DIR}/control/run.sh not found!"
    exit 1
fi
