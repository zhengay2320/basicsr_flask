from pathlib import Path
import yaml

from app.extensions import db
from app.models.task import Task
from app.models.task_config import TaskConfig
from app.services.basicsr_service import BasicSRService

import yaml
from app.models import TaskConfig, Task
from flask import jsonify


class ConfigService:
    def __init__(self, basicsr_root: str, storage_root: str):
        self.basicsr_service = BasicSRService(basicsr_root)
        self.storage_root = Path(storage_root).resolve()

    def _ensure_task_config_dir(self, user_id: int, task_id: int):
        config_dir = self.storage_root / "users" / str(user_id) / "tasks" / str(task_id) / "configs"
        config_dir.mkdir(parents=True, exist_ok=True)
        return config_dir

    def get_task_or_raise(self, task_id: int, user_id: int):
        task = Task.query.filter_by(id=task_id, user_id=user_id, is_deleted=False).first()
        if not task:
            raise ValueError("task not found")
        return task

    def get_current_config(self, task_id: int, user_id: int):
        task = self.get_task_or_raise(task_id, user_id)
        if not task.current_config_id:
            raise ValueError("task has no current config")

        config = TaskConfig.query.filter_by(
            id=task.current_config_id,
            task_id=task.id,
            user_id=user_id
        ).first()

        if not config:
            raise ValueError("current config not found")

        return task, config

    def list_versions(self, task_id: int, user_id: int):
        task = self.get_task_or_raise(task_id, user_id)
        configs = TaskConfig.query.filter_by(
            task_id=task.id,
            user_id=user_id
        ).order_by(TaskConfig.version_no.desc()).all()
        return task, configs

    def create_new_version_from_text(self, task_id: int, user_id: int, config_text: str, config_name: str = None):
        task = self.get_task_or_raise(task_id, user_id)

        parsed = yaml.safe_load(config_text)
        if parsed is None:
            parsed = {}
        if not isinstance(parsed, dict):
            raise ValueError("配置内容必须能解析为 YAML 对象(dict)")

        latest = TaskConfig.query.filter_by(
            task_id=task.id,
            user_id=user_id
        ).order_by(TaskConfig.version_no.desc()).first()

        next_version = 1 if not latest else latest.version_no + 1
        config_dir = self._ensure_task_config_dir(user_id, task.id)

        yaml_filename = f"task_{task.id}_v{next_version}.yml"
        yaml_path = config_dir / yaml_filename

        with yaml_path.open("w", encoding="utf-8") as f:
            yaml.safe_dump(parsed, f, allow_unicode=True, sort_keys=False)

        config_hash = self.basicsr_service.make_config_hash(parsed)

        new_config = TaskConfig(
            task_id=task.id,
            user_id=user_id,
            version_no=next_version,
            config_name=config_name or f"{task.task_name}_v{next_version}",
            yaml_path=str(yaml_path),
            config_json=parsed,
            config_hash=config_hash,
            is_active=True
        )
        db.session.add(new_config)
        db.session.flush()

        task.current_config_id = new_config.id
        task.config_version = next_version
        db.session.commit()

        return task, new_config

    def rollback_to_version(self, task_id: int, user_id: int, version_no: int):
        task = self.get_task_or_raise(task_id, user_id)

        old_config = TaskConfig.query.filter_by(
            task_id=task.id,
            user_id=user_id,
            version_no=version_no
        ).first()

        if not old_config:
            raise ValueError("指定版本不存在")

        yaml_text = yaml.safe_dump(old_config.config_json, allow_unicode=True, sort_keys=False)
        rollback_name = f"{task.task_name}_rollback_from_v{version_no}"

        return self.create_new_version_from_text(
            task_id=task.id,
            user_id=user_id,
            config_text=yaml_text,
            config_name=rollback_name
        )


# app/services/config_service.py



def load_yaml_config(yaml_path):
    """读取YML文件并返回解析后的内容"""
    with open(yaml_path, 'r') as file:
        return yaml.safe_load(file)


def filter_model_config(yaml_data, model_name):
    """根据模型名称过滤模板配置"""
    valid_models = []

    # 检查是否包含网络配置
    if "network_g" in yaml_data:
        network_config = yaml_data["network_g"]

        # 如果模型类型与目标模型匹配，加入有效模型列表
        if network_config.get("type") == model_name:
            valid_models.append(model_name)

    return valid_models


def get_training_config(yaml_data):
    """提取训练配置，包括学习率，优化器，调度器等"""
    training_config = {}

    if "train" in yaml_data:
        train_config = yaml_data["train"]

        # 获取训练参数和优化器配置
        training_config["ema_decay"] = train_config.get("ema_decay", 0.999)
        training_config["optim_g"] = train_config.get("optim_g", {})
        training_config["optim_d"] = train_config.get("optim_d", {})
        training_config["scheduler"] = train_config.get("scheduler", {})
        training_config["total_iter"] = train_config.get("total_iter", 400000)
        training_config["warmup_iter"] = train_config.get("warmup_iter", -1)
        training_config["losses"] = train_config.get("losses", {})
        training_config["save_checkpoint_freq"] = train_config.get("logger", {}).get("save_checkpoint_freq", 5000)
        training_config["print_freq"] = train_config.get("logger", {}).get("print_freq", 100)

    return training_config
