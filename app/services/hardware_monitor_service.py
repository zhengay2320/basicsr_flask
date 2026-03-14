from pathlib import Path
import platform
import traceback
import subprocess
import shutil

import psutil

try:
    import pynvml
    NVML_AVAILABLE = True
except Exception:
    pynvml = None
    NVML_AVAILABLE = False


class HardwareMonitorService:
    def __init__(self):
        self.nvml_ready = False
        self.nvml_error = None
        self.backend = "none"

        if NVML_AVAILABLE and pynvml is not None:
            try:
                pynvml.nvmlInit()
                self.nvml_ready = True
                self.backend = "pynvml"
            except Exception as e:
                self.nvml_ready = False
                self.nvml_error = str(e)

        if not self.nvml_ready:
            if self._has_nvidia_smi():
                self.backend = "nvidia-smi"
            else:
                self.backend = "none"

    def _get_disk_root(self):
        """
        Windows 下用当前盘符根目录，Linux/macOS 用 /
        """
        try:
            cwd = Path.cwd()
            anchor = cwd.anchor
            if anchor:
                return anchor
        except Exception:
            pass
        return "/"

    def _has_nvidia_smi(self):
        return shutil.which("nvidia-smi") is not None

    def get_cpu_memory_info(self):
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            vm = psutil.virtual_memory()

            disk_root = self._get_disk_root()
            disk = psutil.disk_usage(disk_root)

            return {
                "ok": True,
                "cpu_percent": cpu_percent,
                "memory_percent": vm.percent,
                "memory_total_gb": round(vm.total / 1024 / 1024 / 1024, 2),
                "memory_used_gb": round(vm.used / 1024 / 1024 / 1024, 2),
                "memory_available_gb": round(vm.available / 1024 / 1024 / 1024, 2),
                "disk_root": disk_root,
                "disk_percent": disk.percent,
                "disk_total_gb": round(disk.total / 1024 / 1024 / 1024, 2),
                "disk_used_gb": round(disk.used / 1024 / 1024 / 1024, 2),
                "disk_free_gb": round(disk.free / 1024 / 1024 / 1024, 2),
                "platform": platform.system()
            }
        except Exception as e:
            return {
                "ok": False,
                "error": str(e),
                "trace": traceback.format_exc()
            }

    def parse_gpu_devices(self, gpu_devices: str):
        """
        "0,1" -> [0, 1]
        """
        if not gpu_devices:
            return []

        result = []
        for item in str(gpu_devices).split(","):
            item = item.strip()
            if item.isdigit():
                result.append(int(item))
        return result

    def get_all_gpu_indices_pynvml(self):
        if not self.nvml_ready:
            return []
        try:
            count = pynvml.nvmlDeviceGetCount()
            return list(range(count))
        except Exception:
            return []

    def get_gpu_info_by_indices_pynvml(self, gpu_indices):
        results = []

        if not self.nvml_ready:
            return {
                "ok": False,
                "error": self.nvml_error or "NVML is not ready",
                "gpus": results
            }

        for idx in gpu_indices:
            try:
                handle = pynvml.nvmlDeviceGetHandleByIndex(int(idx))

                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)

                name = pynvml.nvmlDeviceGetName(handle)
                if isinstance(name, bytes):
                    name = name.decode("utf-8", errors="ignore")

                try:
                    temperature = pynvml.nvmlDeviceGetTemperature(
                        handle, pynvml.NVML_TEMPERATURE_GPU
                    )
                except Exception:
                    temperature = None

                try:
                    power = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000.0
                except Exception:
                    power = None

                try:
                    fan_speed = pynvml.nvmlDeviceGetFanSpeed(handle)
                except Exception:
                    fan_speed = None

                total_mb = mem_info.total / 1024 / 1024
                used_mb = mem_info.used / 1024 / 1024

                results.append({
                    "gpu_index": int(idx),
                    "gpu_name": name,
                    "util_percent": util.gpu,
                    "mem_used_mb": round(used_mb, 2),
                    "mem_total_mb": round(total_mb, 2),
                    "mem_percent": round((used_mb / total_mb) * 100, 2) if total_mb > 0 else 0,
                    "temperature": temperature,
                    "power_w": round(power, 2) if power is not None else None,
                    "fan_speed": fan_speed
                })
            except Exception as e:
                results.append({
                    "gpu_index": int(idx),
                    "error": str(e)
                })

        return {
            "ok": True,
            "error": None,
            "gpus": results
        }

    def get_all_gpu_indices_nvidia_smi(self):
        if not self._has_nvidia_smi():
            return []

        try:
            cmd = [
                "nvidia-smi",
                "--query-gpu=index",
                "--format=csv,noheader,nounits"
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=5
            )

            if result.returncode != 0:
                return []

            indices = []
            for line in result.stdout.splitlines():
                line = line.strip()
                if line.isdigit():
                    indices.append(int(line))
            return indices
        except Exception:
            return []

    def get_gpu_info_by_indices_nvidia_smi(self, gpu_indices):
        """
        用 nvidia-smi 查询指定 GPU。
        """
        results = []

        if not self._has_nvidia_smi():
            return {
                "ok": False,
                "error": "nvidia-smi command not found",
                "gpus": results
            }

        if not gpu_indices:
            return {
                "ok": True,
                "error": None,
                "gpus": results
            }

        try:
            index_str = ",".join(str(i) for i in gpu_indices)

            cmd = [
                "nvidia-smi",
                f"--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,fan.speed",
                "--format=csv,noheader,nounits",
                "-i",
                index_str
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=5
            )

            if result.returncode != 0:
                return {
                    "ok": False,
                    "error": result.stderr.strip() or result.stdout.strip() or "nvidia-smi failed",
                    "gpus": results
                }

            for line in result.stdout.splitlines():
                line = line.strip()
                if not line:
                    continue

                parts = [p.strip() for p in line.split(",")]
                # 期望字段顺序:
                # index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,fan.speed
                if len(parts) < 8:
                    continue

                try:
                    idx = int(parts[0])
                    name = parts[1]
                    util_percent = float(parts[2]) if parts[2] not in ["N/A", "[N/A]"] else 0
                    mem_used_mb = float(parts[3]) if parts[3] not in ["N/A", "[N/A]"] else 0
                    mem_total_mb = float(parts[4]) if parts[4] not in ["N/A", "[N/A]"] else 0
                    temperature = int(float(parts[5])) if parts[5] not in ["N/A", "[N/A]"] else None
                    power_w = float(parts[6]) if parts[6] not in ["N/A", "[N/A]"] else None
                    fan_speed = int(float(parts[7])) if parts[7] not in ["N/A", "[N/A]"] else None

                    results.append({
                        "gpu_index": idx,
                        "gpu_name": name,
                        "util_percent": util_percent,
                        "mem_used_mb": round(mem_used_mb, 2),
                        "mem_total_mb": round(mem_total_mb, 2),
                        "mem_percent": round((mem_used_mb / mem_total_mb) * 100, 2) if mem_total_mb > 0 else 0,
                        "temperature": temperature,
                        "power_w": round(power_w, 2) if power_w is not None else None,
                        "fan_speed": fan_speed
                    })
                except Exception as e:
                    results.append({
                        "raw": line,
                        "error": str(e)
                    })

            return {
                "ok": True,
                "error": None,
                "gpus": results
            }
        except Exception as e:
            return {
                "ok": False,
                "error": str(e),
                "gpus": results
            }

    def get_run_hardware_snapshot(self, run):
        """
        针对某个 run 返回硬件快照
        """
        system_info = self.get_cpu_memory_info()
        parsed_gpu_indices = self.parse_gpu_devices(run.gpu_devices or "")

        if run.gpu_mode == "cpu":
            effective_gpu_indices = []
        else:
            if self.backend == "pynvml":
                effective_gpu_indices = parsed_gpu_indices if parsed_gpu_indices else self.get_all_gpu_indices_pynvml()
                gpu_info_result = self.get_gpu_info_by_indices_pynvml(effective_gpu_indices)
            elif self.backend == "nvidia-smi":
                effective_gpu_indices = parsed_gpu_indices if parsed_gpu_indices else self.get_all_gpu_indices_nvidia_smi()
                gpu_info_result = self.get_gpu_info_by_indices_nvidia_smi(effective_gpu_indices)
            else:
                effective_gpu_indices = []
                gpu_info_result = {
                    "ok": False,
                    "error": self.nvml_error or "Neither pynvml nor nvidia-smi is available",
                    "gpus": []
                }

        if run.gpu_mode == "cpu":
            gpu_info_result = {
                "ok": True,
                "error": None,
                "gpus": []
            }

        return {
            "system": system_info,
            "gpu_meta": {
                "backend": self.backend,
                "nvml_available": NVML_AVAILABLE,
                "nvml_ready": self.nvml_ready,
                "nvml_error": self.nvml_error,
                "nvidia_smi_found": self._has_nvidia_smi(),
                "requested_gpu_devices": run.gpu_devices,
                "parsed_gpu_indices": parsed_gpu_indices,
                "effective_gpu_indices": effective_gpu_indices
            },
            "gpus": gpu_info_result.get("gpus", []),
            "gpu_ok": gpu_info_result.get("ok", False),
            "gpu_error": gpu_info_result.get("error")
        }
