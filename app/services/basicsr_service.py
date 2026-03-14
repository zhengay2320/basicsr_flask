import copy
import hashlib
import json
import os
import sys
from pathlib import Path

import yaml


class BasicSRService:
    def __init__(self, basicsr_root: str):
        self.basicsr_root = Path(basicsr_root).resolve()
        self.options_root = self.basicsr_root / "options"

    def scan_templates(self, scene_type: str = None):
        """
        递归扫描 options/train 与 options/test 下的 yml/yaml 文件
        """
        results = []

        target_dirs = []
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
                if file_path.suffix.lower() in [".yml", ".yaml"]:
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

    def scan_modules(self):
        """
        扫描 basicsr 下常见模块目录中的 py 文件名
        这是第一版的工程实现方式，简单直接；
        后续可以替换成读取 registry。
        """
        mapping = {
            "archs": self.basicsr_root / "basicsr" / "archs",
            "models": self.basicsr_root / "basicsr" / "models",
            "data": self.basicsr_root / "basicsr" / "data",
            "losses": self.basicsr_root / "basicsr" / "losses",
            "metrics": self.basicsr_root / "basicsr" / "metrics",
        }

        result = {}
        for key, folder in mapping.items():
            names = []
            if folder.exists():
                for file_path in folder.glob("*.py"):
                    if file_path.name.startswith("__"):
                        continue
                    names.append(file_path.stem)
            result[key] = sorted(list(set(names)))
        return result

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

    def apply_selected_replacements(self, config: dict, replacements: dict):
        """
        这里约定前端传入以下替换项：
        - model_type
        - network_g_type
        - train_dataset_type
        - val_dataset_type
        - loss_type
        - metric_type

        只替换存在的字段，不强行构造不存在的复杂结构。
        """
        data = copy.deepcopy(config)

        model_type = replacements.get("model_type")
        if model_type:
            data["model_type"] = model_type

        network_g_type = replacements.get("network_g_type")
        if network_g_type and isinstance(data.get("network_g"), dict):
            data["network_g"]["type"] = network_g_type

        train_dataset_type = replacements.get("train_dataset_type")
        if train_dataset_type and isinstance(data.get("datasets", {}).get("train"), dict):
            data["datasets"]["train"]["type"] = train_dataset_type

        val_dataset_type = replacements.get("val_dataset_type")
        if val_dataset_type and isinstance(data.get("datasets", {}).get("val"), dict):
            data["datasets"]["val"]["type"] = val_dataset_type

        loss_type = replacements.get("loss_type")
        if loss_type and isinstance(data.get("train"), dict):
            # 常见情况：pixel_opt / perceptual_opt / gan_opt
            for key in ["pixel_opt", "perceptual_opt", "gan_opt"]:
                if isinstance(data["train"].get(key), dict):
                    data["train"][key]["type"] = loss_type
                    break

        metric_type = replacements.get("metric_type")
        if metric_type and isinstance(data.get("val", {}).get("metrics"), dict):
            for metric_name, metric_cfg in data["val"]["metrics"].items():
                if isinstance(metric_cfg, dict):
                    metric_cfg["type"] = metric_type
                    break

        return data

    def parse_patch_text(self, text: str):
        if not text or not text.strip():
            return {}

        text = text.strip()

        # 优先按 YAML 解析，YAML 也能兼容 JSON
        parsed = yaml.safe_load(text)
        if parsed is None:
            return {}
        if not isinstance(parsed, dict):
            raise ValueError("Patch text must parse to a dict/object.")
        return parsed

    def make_config_hash(self, config: dict):
        raw = json.dumps(config, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def scan_templates(self, scene_type: str = None):
        results = []
        target_dirs = []
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
                if file_path.suffix.lower() in [".yml", ".yaml"]:
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

    def scan_modules(self):
        """
        优先通过 BasicSR 的 Registry 机制获取真实可用的类型名称，而不是简单使用文件名。
        这样可以保证：
        - 前端下拉框里的名字与 YAML 中的 `type` 完全一致（例如 RRDBNet）
        - 不再出现 rrdb_net (文件名) 与 RRDBNet (真正类型名) 对不上的问题
        """
        try:
            # 确保可以从 BASICSR_ROOT 导入 basicsr 包
            # 约定：BASICSR_ROOT 形如 /path/to/BasicSR，其中包含子目录 basicsr/ 和 options/
            basicsr_path = str(self.basicsr_root)
            if basicsr_path not in sys.path:
                sys.path.insert(0, basicsr_path)

            # 导入各个模块以触发注册
            import basicsr.archs  # noqa: F401
            import basicsr.data   # noqa: F401
            import basicsr.models  # noqa: F401
            import basicsr.losses  # noqa: F401
            import basicsr.metrics  # noqa: F401

            from basicsr.utils.registry import (
                ARCH_REGISTRY,
                DATASET_REGISTRY,
                MODEL_REGISTRY,
                LOSS_REGISTRY,
                METRIC_REGISTRY,
            )

            result = {
                "archs": sorted(list(ARCH_REGISTRY.keys())),
                "models": sorted(list(MODEL_REGISTRY.keys())),
                "data": sorted(list(DATASET_REGISTRY.keys())),
                "losses": sorted(list(LOSS_REGISTRY.keys())),
                "metrics": sorted(list(METRIC_REGISTRY.keys())),
            }
            return result
        except Exception:
            # 回退到基于文件名的老实现，防止在特殊环境下直接崩溃
            mapping = {
                "archs": self.basicsr_root / "basicsr" / "archs",
                "models": self.basicsr_root / "basicsr" / "models",
                "data": self.basicsr_root / "basicsr" / "data",
                "losses": self.basicsr_root / "basicsr" / "losses",
                "metrics": self.basicsr_root / "basicsr" / "metrics",
            }

            result = {}
            for key, folder in mapping.items():
                names = []
                if folder.exists():
                    for file_path in folder.glob("*.py"):
                        if file_path.name.startswith("__"):
                            continue
                        names.append(file_path.stem)
                result[key] = sorted(list(set(names)))
            return result

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

