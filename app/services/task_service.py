from pathlib import Path

import yaml

from app.extensions import db
from app.models.task import Task
from app.models.task_config import TaskConfig
from app.services.basicsr_service import BasicSRService


class TaskService:
    def __init__(self, basicsr_root: str, storage_root: str):
        self.basicsr_service = BasicSRService(basicsr_root)
        self.storage_root = Path(storage_root).resolve()

    def _ensure_task_dir(self, user_id: int, task_id: int):
        task_dir = self.storage_root / "users" / str(user_id) / "tasks" / str(task_id)
        config_dir = task_dir / "configs"
        runs_dir = task_dir / "runs"
        config_dir.mkdir(parents=True, exist_ok=True)
        runs_dir.mkdir(parents=True, exist_ok=True)
        return {"task_dir": task_dir, "config_dir": config_dir, "runs_dir": runs_dir}

    def list_templates(self, scene_type=None):
        return self.basicsr_service.scan_templates(scene_type=scene_type)

    def list_modules(self):
        return self.basicsr_service.scan_modules()

    def get_template_detail(self, relative_path: str):
        return self.basicsr_service.load_yaml_by_relative_path(relative_path)

    def get_template_section(self, relative_path: str, section_path: str):
        return self.basicsr_service.get_section(relative_path, section_path)

    def create_task_with_config(
        self,
        user_id: int,
        task_name: str,
        task_type: str,
        description: str,
        template_relative_path: str,
        section_overrides: dict = None,
        manual_patch_text: str = None
    ):
        final_config = self.basicsr_service.load_yaml_by_relative_path(template_relative_path)

        # section_overrides 形如:
        # {
        #   "model_type": "xxx",
        #   "network_g": {...},
        #   "datasets.train": {...},
        #   "datasets.val": {...},
        #   "train.pixel_opt": {...},
        #   "val.metrics": {...}
        # }
        section_overrides = section_overrides or {}

        if section_overrides.get("model_type"):
            final_config["model_type"] = section_overrides["model_type"]

        # 公共的“增量覆盖”逻辑：在原有 section 基础上做深度合并，未指定的字段一律保留
        def merge_section(path_key: str, override_value: dict):
            nonlocal final_config
            if not override_value or not isinstance(override_value, dict):
                return
            original = self.basicsr_service.get_by_path(final_config, path_key) or {}
            merged = self.basicsr_service.deep_merge(original, override_value)
            final_config = self.basicsr_service.apply_section_override(
                final_config, path_key, merged
            )

        if section_overrides.get("network_g") and isinstance(section_overrides["network_g"], dict):
            merge_section("network_g", section_overrides["network_g"])

        if section_overrides.get("datasets.train") and isinstance(section_overrides["datasets.train"], dict):
            merge_section("datasets.train", section_overrides["datasets.train"])

        if section_overrides.get("datasets.val") and isinstance(section_overrides["datasets.val"], dict):
            merge_section("datasets.val", section_overrides["datasets.val"])

        if section_overrides.get("train.pixel_opt") and isinstance(section_overrides["train.pixel_opt"], dict):
            merge_section("train.pixel_opt", section_overrides["train.pixel_opt"])

        if section_overrides.get("val.metrics") and isinstance(section_overrides["val.metrics"], dict):
            merge_section("val.metrics", section_overrides["val.metrics"])

        # 允许前端整体覆盖 train 训练参数（包含优化器、学习率等常见配置），也采用增量合并
        if section_overrides.get("train") and isinstance(section_overrides["train"], dict):
            merge_section("train", section_overrides["train"])

        if manual_patch_text and manual_patch_text.strip():
            manual_patch = self.basicsr_service.parse_patch_text(manual_patch_text)
            final_config = self.basicsr_service.deep_merge(final_config, manual_patch)

        task = Task(
            user_id=user_id,
            task_name=task_name,
            task_type=task_type,
            status="ready",
            description=description,
            source_type="template",
            template_path=template_relative_path,
            config_version=1
        )
        db.session.add(task)
        db.session.flush()

        dirs = self._ensure_task_dir(user_id, task.id)
        yaml_filename = f"task_{task.id}_v1.yml"
        yaml_path = dirs["config_dir"] / yaml_filename

        with yaml_path.open("w", encoding="utf-8") as f:
            yaml.safe_dump(final_config, f, allow_unicode=True, sort_keys=False)

        config_hash = self.basicsr_service.make_config_hash(final_config)
        task_config = TaskConfig(
            task_id=task.id,
            user_id=user_id,
            version_no=1,
            config_name=f"{task.task_name}_v1",
            yaml_path=str(yaml_path),
            config_json=final_config,
            config_hash=config_hash,
            is_active=True
        )
        db.session.add(task_config)
        db.session.flush()

        task.current_config_id = task_config.id
        db.session.commit()

        return task, task_config
