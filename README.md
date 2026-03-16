# BasicSR Flask 深度学习实验管理平台

## 1. 项目简介

BasicSR Flask 是一个面向 **深度学习实验管理** 的 Web 平台，围绕 BasicSR 框架构建，采用 Flask + MySQL + SQLAlchemy + 前端页面交互的方式，将研究中常见的“任务创建、配置管理、训练启动、运行监控、日志查看、版本回滚、结果导出”等流程整合到统一界面中。
### 核心功能预览

|               **任务创建与配置**               |              **运行监控与分析**              |              **日志管理与回滚**              |
|:---------------------------------------:|:-------------------------------------:|:-------------------------------------:|
|   <img src="img/img.png" width="300">   | <img src="img/img_1.png" width="300"> | <img src="img/img_2.png" width="300"> |
| **实验初始化**：支持超参数、消融实验配置，降低手动编辑 YAML 的成本。 |     **状态实时追踪**：直观展示训练进度与系统资源占用情况。     |   **版本化存储**：自动归档所有实验配置，支持快速复现与结果导出。   |

---
本项目适用于以下场景：

- 需要频繁开展超参数试验、对比试验、消融试验的科研任务。
- 需要对 BasicSR 训练 / 测试配置进行版本化管理。
- 需要对多个实验任务进行统一调度、跟踪与复现实验过程。
- 希望降低直接编辑 YAML、手动组织日志目录、手动追踪训练状态的成本。

---

## 2. 使用说明

### 2.1 环境准备

建议环境：

- Ubuntu / Linux
- Python 3.9 及以上
- MySQL 5.7 / 8.0
- 已安装 Git
- 建议使用 Conda 或 venv 创建独立 Python 环境

推荐先准备一个 Python 虚拟环境，例如：

```bash
conda create -n basicsr_platform python=3.10 -y
conda activate basicsr_platform
```

---

### 2.2 克隆本项目

先将本仓库拉到本地：

```bash
git clone https://github.com/zhengay2320/basicsr_flask.git
cd basicsr_flask
```

---

### 2.3 安装 MySQL 并创建数据库

本项目使用 MySQL 作为后端数据库，默认配置中的数据库名为 `basicsr_platform`。

先安装 MySQL（以下为 Ubuntu 示例）：

```bash
sudo apt update
sudo apt install mysql-server -y
```

启动并进入 MySQL：

```bash
sudo systemctl start mysql
sudo mysql -u root -p
```

创建数据库和用户：

```sql
CREATE DATABASE basicsr_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'basicsr_user'@'127.0.0.1' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON basicsr_platform.* TO 'basicsr_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

如果你已经有可用的 MySQL 用户，也可以直接复用，只需要保证数据库连接字符串填写正确即可。

---

### 2.4 安装本项目依赖

进入项目根目录后安装依赖：

```bash
pip install -r requirements.txt
```

如果仓库中的 `requirements.txt` 尚未完善，可以至少补齐以下典型依赖：

```bash
pip install flask flask-sqlalchemy flask-migrate flask-login flask-cors pymysql pyyaml pillow
```

---

### 2.5 克隆 BasicSR 仓库

本项目本身是管理平台，实际训练与测试依赖 BasicSR 主体代码，因此需要再把 BasicSR 拉到本地。

例如：

```bash
cd ..
git clone https://github.com/XPixelGroup/BasicSR.git
```

你也可以把 BasicSR 放到自己的任意目录，但后续需要把该路径写入配置文件。

---

### 2.6 安装 BasicSR

进入 BasicSR 目录安装：

```bash
cd BasicSR
pip install -r requirements.txt
python setup.py develop
```

如果你的训练依赖 PyTorch、CUDA、opencv、lmdb 等组件，需要根据自己的 GPU / CUDA 环境额外安装。建议先确保 BasicSR 单独运行没有问题，再接入本平台。

---

### 2.7 修改项目配置文件

本项目的默认配置文件位于：

```text
app/config/default.py
```

项目当前默认配置中包含以下关键参数：

- `SQLALCHEMY_DATABASE_URI`：MySQL 数据库连接地址
- `BASICSR_ROOT`：BasicSR 仓库所在目录
- `STORAGE_ROOT`：平台用于保存任务配置、运行日志、结果文件等内容的目录
- `PYTHON_EXEC`：运行 BasicSR 训练/测试时使用的 Python 解释器路径
- `SECRET_KEY`：Flask 会话密钥

建议你根据本地环境修改为自己的实际路径，例如：

```python
import os
from datetime import timedelta

class DefaultConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "replace-this-secret")

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URI",
        "mysql+pymysql://basicsr_user:your_password@127.0.0.1:3306/basicsr_platform?charset=utf8mb4"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_AS_ASCII = False

    BASICSR_ROOT = os.getenv("BASICSR_ROOT", "/home/yourname/BasicSR")
    STORAGE_ROOT = os.getenv("STORAGE_ROOT", "/home/yourname/basicsr_storage")
    PYTHON_EXEC = os.getenv("PYTHON_EXEC", "/home/yourname/miniconda3/envs/basicsr_platform/bin/python")

    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = "Lax"
```

其中：

- `BASICSR_ROOT` 必须指向你刚刚 clone 下来的 BasicSR 根目录。
- `STORAGE_ROOT` 建议单独建立目录，例如：

```bash
mkdir -p /home/yourname/basicsr_storage
```

- `PYTHON_EXEC` 建议填写当前平台运行环境中的 Python 绝对路径，例如：

```bash
which python
```

如果你希望用环境变量覆盖，也可以这样启动：

```bash
export DATABASE_URI='mysql+pymysql://basicsr_user:your_password@127.0.0.1:3306/basicsr_platform?charset=utf8mb4'
export BASICSR_ROOT='/home/yourname/BasicSR'
export STORAGE_ROOT='/home/yourname/basicsr_storage'
export PYTHON_EXEC='/home/yourname/miniconda3/envs/basicsr_platform/bin/python'
```

---

### 2.8 初始化数据库表

仓库中已经包含 `migrations/` 目录，因此通常可以直接执行迁移：

```bash
flask db upgrade
```

如果当前环境中没有设置 Flask 应用入口，可以先导出：

```bash
export FLASK_APP=run.py
flask db upgrade
```

如果你是第一次部署，推荐再确认数据库中已经生成用户、任务、任务配置、运行记录等相关表。

---

### 2.9 运行项目

在项目根目录执行：

```bash
python run.py
```

项目默认启动在：

```text
http://127.0.0.1:5000
```

浏览器访问后即可进入登录页 / 平台首页。

---

### 2.10 基本使用流程

启动平台后，推荐按以下流程使用：

1. 注册或登录用户。
2. 创建实验任务。
3. 选择或生成 BasicSR 配置模板。
4. 保存配置版本。
5. 启动训练 / 测试运行。
6. 在运行监控页面查看日志、指标曲线与运行状态。
7. 根据结果继续修改配置、回滚版本或导出任务结果。

---

## 3. 项目解决的核心需求

在深度学习实验过程中，尤其是基于 BasicSR 的图像恢复、超分辨率、去噪、增强类任务，研究者通常会遇到如下问题：

### 3.1 实验配置复杂且易混乱

BasicSR 主要依赖 YAML 配置文件驱动训练和测试。随着实验数量增加，往往会出现：

- 同一任务有多个配置变体
- 不同实验之间参数修改缺乏记录
- 无法快速追溯“某次最好结果究竟对应哪版配置”

### 3.2 任务与运行分离不清

很多实验环境中，“任务定义”和“某次运行实例”是混在一起的，导致：

- 无法复用任务模板
- 同一任务的多次运行不易比较
- 删除、回滚、重新运行都较困难

### 3.3 训练过程依赖命令行与手工日志整理

常规 BasicSR 使用方式偏命令行，研究者往往需要：

- 手工切换配置文件
- 手工启动训练脚本
- 手工查看日志文件
- 手工整理 TensorBoard 路径和输出目录

这会增加使用门槛，也不利于多人协作。

### 3.4 缺少统一的实验追踪与管理界面

当实验数量较多时，仅靠 shell 命令、目录命名和零散日志已经难以支持：

- 系统化管理任务
- 追踪运行状态
- 快速回看历史版本
- 导出结果并形成实验记录

本项目正是针对这些问题进行设计，目标是把深度学习实验的管理工作从“脚本驱动”提升到“平台化管理”。

---

## 4. 主要功能

### 4.1 用户认证与基础页面

项目提供登录、注册、个人主页、控制台等基础能力，用于支持多用户使用与基本权限隔离。

### 4.2 实验任务管理

平台支持创建、查看、删除任务，并围绕任务组织其配置、运行记录和结果文件。

任务是实验管理的核心实体，承担“实验主题 / 实验对象”的角色。

### 4.3 任务描述维护

任务描述不只是创建时填写一次，而是可以随着实验推进不断更新，用于记录当前实验目的、数据说明、模型差异和阶段结论，使任务页面兼具“管理入口”和“实验备注”的作用。

### 4.4 BasicSR 配置模板读取与生成

平台可结合 BasicSR 根目录中的模板配置进行管理，支持：

- 扫描训练 / 测试配置模板
- 生成任务当前配置
- 将配置转为可编辑文本
- 保存为平台侧配置版本

### 4.5 配置版本管理

系统支持对任务配置进行版本化保存，并提供：

- 当前配置查看
- 历史版本列表
- 新版本保存
- 指定版本回滚

这使得实验配置具备了“版本控制”的能力，有助于提升复现性。

### 4.6 训练 / 测试运行管理

平台支持从任务发起具体运行，并记录每次 run 的状态、目录、日志、配置及相关元数据。

这意味着：

- 一个任务可以对应多次运行
- 每次运行都有独立记录
- 便于比较不同配置或不同数据条件下的实验结果

### 4.7 运行控制与状态管理

项目中包含运行控制相关接口，可为运行实例提供启动、控制、状态更新等能力，为后续进一步扩展暂停、恢复、终止等控制机制打下基础。

### 4.8 监控与日志查看

平台整合训练监控页面，用于展示：

- 运行状态
- 日志内容
- 训练过程曲线
- 可能的硬件监控信息

相比传统命令行查看方式，这种可视化监控更适合高频实验场景。

### 4.9 导出功能

项目提供任务导出接口，便于将实验记录、配置与结果进一步整理和归档。

---

## 5. 项目实现特色与优势

### 5.1 面向 BasicSR 的垂直化实验平台

本项目不是泛化的 MLOps 平台，而是紧贴 BasicSR 工作流构建，因此在以下方面更有针对性：

- 配置模板贴合 BasicSR YAML 结构
- 训练 / 测试入口贴合 BasicSR 使用方式
- 适用于图像超分辨、恢复、增强等研究任务

### 5.2 任务、配置、运行三层解耦

这是项目设计中非常重要的一点：

- **任务（Task）**：描述一个实验主题
- **配置（Config）**：描述任务当前使用或历史使用的参数版本
- **运行（Run）**：描述在某一时刻基于某个配置执行的一次具体实验

这种设计显著提升了：

- 实验复用能力
- 历史追踪能力
- 多次运行对比能力
- 配置回滚能力

### 5.3 配置版本化提升复现性

传统实验中，很多结果之所以难复现，是因为配置文件修改频繁、记录不足。本项目将配置版本纳入数据库和平台管理，能显著降低“结果无法回溯”的风险。

### 5.4 统一存储与结构化组织

通过 `STORAGE_ROOT` 统一保存任务和运行过程中产生的文件，便于：

- 日志归档
- 配置归档
- 结果整理
- 任务导出

这优于很多研究项目中“文件散落在多个目录”的情况。

### 5.5 降低命令行使用门槛

对于不希望频繁手工编辑 YAML 和敲命令的使用者，平台化界面能够降低操作复杂度，减少因命令错误、路径错误、配置覆盖不一致带来的问题。

### 5.6 更适合教学、实验室与多人协作环境

该项目非常适合：

- 高校科研训练
- 实验室内部统一管理 BasicSR 实验
- 课程项目中的模型训练管理
- 中小规模研究团队的实验记录平台

---

## 6. 系统结构概览

从仓库结构看，项目大致包含以下模块：

```text
app/
├── api/            # 后端接口：认证、任务、配置、运行、监控、导出等
├── config/         # 项目配置
├── models/         # 数据模型
├── services/       # 业务服务层
├── static/         # 前端静态资源
├── templates/      # 页面模板
├── utils/          # 工具函数
├── web.py          # 页面路由
└── __init__.py     # Flask app 创建与蓝图注册
```

系统整体属于典型的 Flask 分层结构：

- **模型层**：负责数据库实体定义
- **服务层**：负责任务、配置、运行等业务逻辑
- **接口层**：负责前后端数据交互
- **页面层**：负责用户可视化操作界面

---

## 7. 相关研究与参考方向

本项目虽然是一个工程实现，但其设计思路与当前机器学习系统和实验管理研究高度相关，主要可归纳为以下几个方向：

### 7.1 机器学习实验追踪（Experiment Tracking）

实验追踪的核心目标是统一记录：

- 参数（parameters）
- 指标（metrics）
- 配置（configs）
- 产物（artifacts）
- 运行信息（runs）

这一方向的代表性平台包括 MLflow、Weights & Biases 等。你的项目与这一方向的共通点在于：

- 关注实验的可追踪性
- 将任务与运行记录结构化存储
- 支持结果回看和版本管理

但不同之处在于，你的项目更聚焦于 **BasicSR 场景下的垂直整合**。

### 7.2 机器学习可复现性（Reproducibility）

近年来大量研究强调：深度学习实验结果不仅要“能跑出来”，还要“能被重复出来”。实现复现性通常依赖：

- 明确的配置管理
- 可追踪的数据路径
- 完整的日志记录
- 独立的运行实例管理

本项目中的配置版本、任务记录、运行管理，本质上都服务于这一目标。

### 7.3 面向特定框架的实验平台

相比通用 MLOps 平台，很多研究和工程系统会围绕某个具体框架构建专用实验平台，例如围绕检测、分割、生成或图像恢复框架形成垂直工具链。

你的项目正体现了这种思路：

- 不追求覆盖所有深度学习任务
- 而是围绕 BasicSR 的使用痛点进行深度适配
- 更强调研究效率与实验闭环，而非企业级大规模部署

---

## 8. 适用场景

本项目尤其适合以下用户：

- 使用 BasicSR 进行超分辨率、去噪、图像恢复研究的研究者
- 需要持续进行参数调优和多轮试验的学生或工程师
- 希望将实验流程网页化、结构化管理的实验室团队
- 想基于 Flask 构建轻量级实验平台的开发者

---

## 9. 后续可扩展方向

基于当前项目，还可以继续扩展：

1. 更完整的权限管理与多用户协作机制。
2. 更细粒度的运行控制，例如暂停、恢复、强制终止。
3. 对 TensorBoard、图片结果、模型权重的可视化管理。
4. 自动记录 GPU 占用、显存、训练速度等系统指标。
5. 接入消息通知，例如训练结束邮件 / Webhook / 企业微信通知。
6. 增加实验对比页面，用于比较多个 run 的指标和配置差异。
7. 支持更多训练框架，而不仅限于 BasicSR。

---

## 10. 总结

BasicSR Flask 的核心价值，在于把原本分散在命令行、YAML 文件、日志目录和手工记录中的深度学习实验流程，整合为一个可管理、可追踪、可版本化的统一平台。

它不是一个追求“大而全”的通用 MLOps 系统，而是一个非常适合 **BasicSR 研究场景** 的轻量级实验管理平台。对于希望提升实验组织效率、增强结果复现能力、减少配置混乱问题的研究者来说，这类平台具有很强的实用意义。
