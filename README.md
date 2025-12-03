调度器部分代码在/app
单卡调度运行方式
python ./app/main_gpu.py
后台运行
nohup python ./app/main_gpu.py > /dev/null 2>&1 &
多卡调度后台运行
nohup python ./app/main_gpus.py > /dev/null 2>&1 &
配置文件在./config/gpu_manage.yaml
命令文件在./command_gpu.txt（单卡）或./command_gpus.txt（多卡）

前端代码在./control
开启前端
bash ./run_control.sh
登陆密码保存在./config/control_setting.yaml，包括前端配置，可自行配置
终止前端
bash
bash ./shut_down.sh
