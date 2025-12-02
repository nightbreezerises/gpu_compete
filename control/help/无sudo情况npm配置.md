# 无 sudo 情况下的 npm 使用与项目自带 node 环境

 本说明适用于 **没有 sudo 权限** 的场景，优先使用项目自带的 node/npm 环境（`~/app/node-local`），同时给出备用的无 sudo npm 全局配置方案。

> 如需通过代理访问外网，可在执行前先设置你已有的代理环境变量，再执行以下命令。

 ---

 ## 方式 0：使用项目自带的 node/npm（推荐）

 项目已在 `~/app/node-local` 中提供了一份独立的 node/npm 运行环境，无需系统预装 node/npm，就可以直接使用。

 ### 0.1 临时在当前终端启用 node-local 环境

 ```bash
 export PATH=$HOME/app/node-local/bin:$PATH

 # 检查版本
 node -v
 npm -v
 ```

 执行以上命令后，当前终端中的 `node` / `npm` / `npx` 等命令都会优先使用 `~/app/node-local` 中的版本。

 ### 0.2 长期生效（写入 shell 配置）

 根据你使用的 shell，选择其一：

 - 如果你使用 bash：

   ```bash
   echo 'export PATH=$HOME/app/node-local/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

 - 如果你使用 zsh：

   ```bash
   echo 'export PATH=$HOME/app/node-local/bin:$PATH' >> ~/.zshrc
   source ~/.zshrc
   ```

 之后每次打开新的终端窗口，都会自动启用 `~/app/node-local` 提供的 node/npm 环境。

 ---

 ## 方式 1：无 sudo 的 npm 全局安装目录（备用方案）

 如果你不想依赖项目自带的 node/npm，或者在其他机器上没有 `~/app/node-local` 目录，可以使用下面的方式手动配置一个无 sudo 的 npm 全局安装目录。

 ### 1.1 创建本地 npm 全局安装目录

 ```bash
 mkdir -p ~/.npm-global
 ```

 ### 1.2 配置 npm 使用该目录

 ```bash
 npm config set prefix '~/.npm-global'
 ```

 这会将 npm 全局安装路径从系统目录（需要 sudo 的地方）改为 `~/.npm-global`。

 ### 1.3 将 ~/.npm-global/bin 加入 PATH

 1. 编辑 shell 配置文件：

    - 如果你使用 bash：

      ```bash
      nano ~/.bashrc
      ```

    - 如果你使用 zsh：

      ```bash
      nano ~/.zshrc
      ```

 2. 在文件末尾添加：

    ```bash
    export PATH=$HOME/.npm-global/bin:$PATH
    ```

 3. 保存并关闭文件。

 ### 1.4 刷新环境变量

 - 如果你使用 bash：

   ```bash
   source ~/.bashrc
   ```

 - 如果你使用 zsh：

   ```bash
   source ~/.zshrc
   ```

 或者直接关闭当前终端重新打开一个新的终端窗口。

 ### 1.5 测试配置

 1. 测试安装全局包（示例：create-react-app）：

    ```bash
    npm install -g create-react-app
    ```

 2. 检查可执行文件是否在 PATH 中：

    ```bash
    which create-react-app
    ```

    正常情况下应输出类似：`/home/你的用户名/.npm-global/bin/create-react-app`。

 ---

 ## 在当前项目中的典型用法

 以下示例默认你已经启用了 **方式 0**（即 `export PATH=$HOME/app/node-local/bin:$PATH` 已生效）。

 假设你的前端项目位于：

 ```bash
 /home/hdl/app/setting_yaml/front_end
 ```

 你可以按如下方式安装依赖并构建前端：

 ```bash
 # 1. 启用项目自带 node/npm 环境（如果尚未启用）
 export PATH=$HOME/app/node-local/bin:$PATH

 # 2. 进入前端项目目录
 cd /home/hdl/app/setting_yaml/front_end

 # 3. （可选）需要代理访问外网依赖时：
 # export http_proxy="http://127.0.0.1:29332" \
 #        https_proxy="http://127.0.0.1:29332" \
 #        all_proxy="socks5://127.0.0.1:29332"

 # 4. 安装项目依赖
 npm install

 # 5. 运行开发环境或构建前端（取决于 package.json 中的 scripts）
 npm run dev    # 如有 dev 脚本
 npm run build  # 构建生产包
 ```

 整体流程总结：

 - 在有 `~/app/node-local` 的机器上：**优先使用方式 0**，无需关心系统是否安装 node/npm，也不需要 sudo。
 - 在没有 `~/app/node-local` 的其他环境上：可以使用 **方式 1** 配置 `~/.npm-global`，同样不需要 sudo 就能安装和使用 npm 相关工具链。
