#!/bin/bash

# 无sudo情况下的npm配置脚本
# 参照 help/无sudo情况npm配置.md 实现

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检测shell类型
detect_shell() {
    if [ -n "$ZSH_VERSION" ]; then
        echo "zsh"
    elif [ -n "$BASH_VERSION" ]; then
        echo "bash"
    else
        # 检查默认shell
        if [[ "$SHELL" == *"zsh"* ]]; then
            echo "zsh"
        else
            echo "bash"
        fi
    fi
}

# 获取shell配置文件路径
get_shell_config() {
    local shell_type=$(detect_shell)
    case $shell_type in
        "zsh")
            echo "$HOME/.zshrc"
            ;;
        "bash")
            echo "$HOME/.bashrc"
            ;;
        *)
            echo "$HOME/.bashrc"
            ;;
    esac
}

# 方式0：使用项目自带的node/npm（推荐）
setup_project_node() {
    log_info "检查项目自带node环境..."
    
    local node_local_dir="$HOME/app/node-local"
    local node_bin="$node_local_dir/bin"
    
    if [ -d "$node_local_dir" ] && [ -f "$node_bin/node" ] && [ -f "$node_bin/npm" ]; then
        log_success "发现项目自带node环境: $node_local_dir"
        
        # 检查PATH中是否已包含
        if [[ ":$PATH:" != *":$node_bin:"* ]]; then
            log_info "添加项目node环境到PATH..."
            export PATH="$node_bin:$PATH"
            
            # 写入shell配置文件
            local shell_config=$(get_shell_config)
            local path_entry="export PATH=\$HOME/app/node-local/bin:\$PATH"
            
            if ! grep -q "$node_bin" "$shell_config" 2>/dev/null; then
                echo "" >> "$shell_config"
                echo "# 项目自带node/npm环境" >> "$shell_config"
                echo "$path_entry" >> "$shell_config"
                log_success "已添加到 $shell_config"
                log_info "请运行: source $shell_config"
            else
                log_info "PATH配置已存在于 $shell_config"
            fi
        else
            log_info "项目node环境已在PATH中"
        fi
        
        # 验证版本
        if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
            log_success "Node版本: $(node -v)"
            log_success "NPM版本: $(npm -v)"
            return 0
        else
            log_error "Node/NPM命令不可用"
            return 1
        fi
    else
        log_warning "未找到项目自带node环境: $node_local_dir"
        return 1
    fi
}

# 方式1：无sudo的npm全局安装目录（备用方案）
setup_npm_global() {
    log_info "配置无sudo的npm全局环境..."
    
    local npm_global_dir="$HOME/.npm-global"
    local npm_global_bin="$npm_global_dir/bin"
    
    # 创建npm全局目录
    if [ ! -d "$npm_global_dir" ]; then
        log_info "创建npm全局目录: $npm_global_dir"
        mkdir -p "$npm_global_dir"
    fi
    
    # 配置npm prefix
    if command -v npm >/dev/null 2>&1; then
        local current_prefix=$(npm config get prefix 2>/dev/null || echo "")
        if [ "$current_prefix" != "$npm_global_dir" ]; then
            log_info "设置npm全局安装目录..."
            npm config set prefix "$npm_global_dir"
            log_success "npm prefix已设置为: $npm_global_dir"
        else
            log_info "npm prefix已正确配置"
        fi
    else
        log_error "npm命令不可用，请先安装node/npm"
        return 1
    fi
    
    # 添加到PATH
    if [[ ":$PATH:" != *":$npm_global_bin:"* ]]; then
        log_info "添加npm全局bin目录到PATH..."
        export PATH="$npm_global_bin:$PATH"
        
        # 写入shell配置文件
        local shell_config=$(get_shell_config)
        local path_entry="export PATH=\$HOME/.npm-global/bin:\$PATH"
        
        if ! grep -q "$npm_global_bin" "$shell_config" 2>/dev/null; then
            echo "" >> "$shell_config"
            echo "# 无sudo的npm全局环境" >> "$shell_config"
            echo "$path_entry" >> "$shell_config"
            log_success "已添加到 $shell_config"
            log_info "请运行: source $shell_config"
        else
            log_info "PATH配置已存在于 $shell_config"
        fi
    else
        log_info "npm全局bin目录已在PATH中"
    fi
    
    return 0
}

# 测试npm配置
test_npm_config() {
    log_info "测试npm配置..."
    
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm命令不可用"
        return 1
    fi
    
    # 显示当前配置
    log_info "当前npm配置:"
    echo "  - npm版本: $(npm -v)"
    echo "  - node版本: $(node -v 2>/dev/null || echo '不可用')"
    echo "  - npm prefix: $(npm config get prefix)"
    echo "  - npm全局安装目录: $(npm config get prefix)/bin"
    
    # 测试全局安装（可选）
    log_info "测试全局包安装..."
    local test_package="npm-check-updates"
    
    if command -v "$test_package" >/dev/null 2>&1; then
        log_success "$test_package 已安装"
    else
        log_info "安装测试包 $test_package..."
        if npm install -g "$test_package" >/dev/null 2>&1; then
            log_success "测试包安装成功"
            log_info "卸载测试包..."
            npm uninstall -g "$test_package" >/dev/null 2>&1
        else
            log_warning "测试包安装失败"
        fi
    fi
    
    return 0
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  -p, --project  仅配置项目自带node环境"
    echo "  -g, --global   仅配置npm全局环境"
    echo "  -t, --test     仅测试当前配置"
    echo "  -a, --auto     自动配置（推荐，先尝试项目node，失败则使用npm全局）"
    echo ""
    echo "示例:"
    echo "  $0              # 自动配置"
    echo "  $0 --project    # 仅配置项目node环境"
    echo "  $0 --global     # 仅配置npm全局环境"
    echo "  $0 --test       # 测试当前配置"
}

# 主函数
main() {
    local mode="auto"
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -p|--project)
                mode="project"
                shift
                ;;
            -g|--global)
                mode="global"
                shift
                ;;
            -t|--test)
                mode="test"
                shift
                ;;
            -a|--auto)
                mode="auto"
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "=========================================="
    echo "🔧 无sudo npm配置脚本"
    echo "=========================================="
    
    case $mode in
        "project")
            log_info "模式: 仅配置项目自带node环境"
            if setup_project_node; then
                test_npm_config
                log_success "项目node环境配置完成！"
            else
                log_error "项目node环境配置失败"
                exit 1
            fi
            ;;
        "global")
            log_info "模式: 仅配置npm全局环境"
            if setup_npm_global; then
                test_npm_config
                log_success "npm全局环境配置完成！"
            else
                log_error "npm全局环境配置失败"
                exit 1
            fi
            ;;
        "test")
            log_info "模式: 测试当前配置"
            test_npm_config
            ;;
        "auto")
            log_info "模式: 自动配置"
            # 优先尝试项目node环境
            if setup_project_node; then
                log_success "使用项目自带node环境"
                test_npm_config
                log_success "自动配置完成！"
            else
                log_warning "项目node环境不可用，尝试npm全局环境..."
                if setup_npm_global; then
                    log_success "使用npm全局环境"
                    test_npm_config
                    log_success "自动配置完成！"
                else
                    log_error "所有配置方式都失败"
                    exit 1
                fi
            fi
            ;;
    esac
    
    echo ""
    echo "=========================================="
    echo "✅ 配置完成！"
    echo ""
    echo "💡 提示："
    echo "   - 如需立即生效，请运行: source $(get_shell_config)"
    echo "   - 或者重新打开终端窗口"
    echo "   - 检查配置: npm config list"
    echo "=========================================="
}

# 执行主函数
main "$@"