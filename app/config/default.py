import os
from datetime import timedelta


class DefaultConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "replace-this-secret")

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URI",
        "mysql+pymysql://zhengay_user:cohy453765348@127.0.0.1:3306/basicsr_platform?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_AS_ASCII = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "replace-this-jwt-secret")

    # BasicSR 项目根目录
    BASICSR_ROOT = os.getenv("BASICSR_ROOT", r"/home/ubuntu/data/zhenganyang/myMLPro")

    # 平台自己存配置、日志、run 目录的根目录
    STORAGE_ROOT = os.getenv("STORAGE_ROOT", r"/home/ubuntu/data/zhenganyang/myMLPro/storage")

    # Python 解释器
    PYTHON_EXEC = os.getenv("PYTHON_EXEC", r"/home/ubuntu/data/miniconda3/envs/zhengay/bin/python")

    # ===== JWT cookie 模式 =====
    JWT_TOKEN_LOCATION = ["cookies"]

    # 短 access token
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)

    # 长 refresh token
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # 本地开发 HTTP 可先 False；线上 HTTPS 改 True
    JWT_COOKIE_SECURE = os.getenv("JWT_COOKIE_SECURE", "False").lower() == "true"

    # 同站点网页推荐 Lax
    JWT_COOKIE_SAMESITE = os.getenv("JWT_COOKIE_SAMESITE", "Lax")

    # 先关闭，等整个站点稳定后再补 CSRF
    JWT_COOKIE_CSRF_PROTECT = False

    JWT_ACCESS_COOKIE_PATH = "/"
    JWT_REFRESH_COOKIE_PATH = "/api/auth/refresh"
