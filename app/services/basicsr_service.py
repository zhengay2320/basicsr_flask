import copy
import hashlib
import json
import logging
import sys
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


class BasicSRService:
    def __init__(self, basicsr_root: str):
        self.basicsr_root = Path(basicsr_root).resolve()
        self.options_root = self.basicsr_root / "options"

    def scan_templates(self, scene_type: str = None):
        """
        递归扫描 options/train 与 options/test 下的 yml/yaml 文件
        """
        results = []
        if scene_type == "train":
            target_dirs = [self.options_root / "train"]
        elif scene_type == "test":
            target_dirs = [self.options_root / "test"]
        else:
            target_dirs = [self.options_root / "train", self.options_root / "test"]

        for base_dir in target_dirs:
            if not base_dir.exists():
                continue

            for file_path in base_dir.rglob("*"):
                if file_path.suffix.lower() not in [".yml", ".yaml"]:
                    continue

                rel_path = str(file_path.relative_to(self.basicsr_root)).replace("\\", "/")
                results.append({
                    "name": file_path.stem,
                    "scene_type": "train" if "train" in rel_path.split("/") else "test",
                    "relative_path": rel_path,
                    "absolute_path": str(file_path),
                    "parent_dir": str(file_path.parent.relative_to(self.basicsr_root)).replace("\\", "/")
                })

        results.sort(key=lambda x: x["relative_path"])
        return results

    def _ensure_import_path(self):
        """
        确保 BASICSR_ROOT 已加入 sys.path。
        约定 BASICSR_ROOT 目录下应同时包含:
        - basicsr/
        - options/
        """
        basicsr_path = str(self.basicsr_root)
        if basicsr_path not in sys.path:
            sys.path.insert(0, basicsr_path)

    def _load_registries(self):
        """
        通过导入 BasicSR 模块触发 registry 注册。
        成功后返回各 registry 对象。
        """
        self._ensure_import_path()

        # 触发模块扫描与注册
        import basicsr.archs  # noqa: F401
        import basicsr.data  # noqa: F401
        import basicsr.models  # noqa: F401
        import basicsr.losses  # noqa: F401
        import basicsr.metrics  # noqa: F401

        from basicsr.utils.registry import (
            ARCH_REGISTRY,
            DATASET_REGISTRY,
            LOSS_REGISTRY,
            METRIC_REGISTRY,
            MODEL_REGISTRY,
        )

        return {
            "archs": ARCH_REGISTRY,
            "models": MODEL_REGISTRY,
            "data": DATASET_REGISTRY,
            "losses": LOSS_REGISTRY,
            "metrics": METRIC_REGISTRY,
        }

    def scan_modules(self):
        """
        只通过 BasicSR 的 Registry 获取真实可用类型名称。
        这样前端拿到的名称就与 YAML 中的 type 一致，例如:
        - RRDBNet
        - SRModel
        - PairedImageDataset

        不再回退到“扫描文件名”的旧逻辑，否则会把 rrdbnet/rrdb_arch
        这类文件名误当成 type，导致创建任务后匹配错误。
        """
        try:
            registries = self._load_registries()
            result = {
                key: sorted(list(registry.keys()))
                for key, registry in registries.items()
            }
            return result
        except Exception as e:
            logger.exception("Failed to load BasicSR registries from %s", self.basicsr_root)
            raise RuntimeError(
                "BasicSR registry 加载失败。"
                "请检查 BASICSR_ROOT 是否指向 BasicSR 根目录，"
                "并确认当前 Python 环境已安装 BasicSR 所需依赖。"
                f"原始错误: {e}"
            ) from e

    def load_yaml_file(self, yaml_path: str):
        yaml_path = Path(yaml_path)
        with yaml_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return data

    def load_yaml_by_relative_path(self, relative_path: str):
        full_path = self.basicsr_root / relative_path
        if not full_path.exists():
            raise FileNotFoundError(f"Template not found: {relative_path}")
        return self.load_yaml_file(str(full_path))

    def deep_merge(self, base: dict, patch: dict):
        """
        递归合并 patch 到 base
        """
        if not isinstance(base, dict) or not isinstance(patch, dict):
            return copy.deepcopy(patch)

        result = copy.deepcopy(base)
        for key, value in patch.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self.deep_merge(result[key], value)
            else:
                result[key] = copy.deepcopy(value)
        return result

    def make_config_hash(self, config: dict):
        raw = json.dumps(config, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def parse_patch_text(self, text: str):
        if not text or not text.strip():
            return {}

        parsed = yaml.safe_load(text)
        if parsed is None:
            return {}

        if not isinstance(parsed, dict):
            raise ValueError("Patch text must parse to a dict/object.")

        return parsed

    def get_by_path(self, data: dict, path: str):
        current = data
        for key in path.split("."):
            if not isinstance(current, dict):
                return None
            current = current.get(key)
            if current is None:
                return None
        return current

    def set_by_path(self, data: dict, path: str, value):
        keys = path.split(".")
        current = data
        for key in keys[:-1]:
            if key not in current or not isinstance(current[key], dict):
                current[key] = {}
            current = current[key]
        current[keys[-1]] = value

    def get_section(self, relative_path: str, section_path: str):
        config = self.load_yaml_by_relative_path(relative_path)
        section = self.get_by_path(config, section_path)
        if section is None:
            return {}
        return copy.deepcopy(section)

    def apply_section_override(self, config: dict, section_path: str, section_value: dict):
        result = copy.deepcopy(config)
        self.set_by_path(result, section_path, section_value)
        return result
