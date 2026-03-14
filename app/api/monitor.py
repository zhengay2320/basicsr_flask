import os
import platform

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

monitor_bp = Blueprint("monitor", __name__)


@monitor_bp.route("/health", methods=["GET"])
def health():
    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "service": "basicsr-platform",
            "status": "running"
        }
    })


@monitor_bp.route("/system", methods=["GET"])
@jwt_required()
def system_info():
    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "python_version": platform.python_version(),
            "hostname": platform.node(),
            "cwd": os.getcwd()
        }
    })


@monitor_bp.route("/gpus", methods=["GET"])
@jwt_required()
def gpu_info():
    # 这里先返回占位数据，后面可替换为 pynvml 真实采集
    return jsonify({
        "code": 200,
        "message": "ok",
        "data": [
            {
                "gpu_index": 0,
                "gpu_name": "Mock GPU 0",
                "total_memory_mb": 24576,
                "used_memory_mb": 4096,
                "gpu_usage": 32.5,
                "status": "idle"
            }
        ]
    })
