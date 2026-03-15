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

    # 平台存配置、日志、run 目录的根目录
    STORAGE_ROOT = os.getenv("STORAGE_ROOT", r"/home/ubuntu/data/zhenganyang/myMLPro/storage")

    # Python 解释器
    PYTHON_EXEC = os.getenv("PYTHON_EXEC", r"/home/ubuntu/data/miniconda3/envs/zhengay/bin/python")

    # =========================
    # JWT 持久登录关键配置
    # =========================

    # JWT 全部走 cookie，不再走前端 localStorage/header
    JWT_TOKEN_LOCATION = ["cookies"]

    # access token 短期
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)

    # refresh token 长期
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # 开发环境如果不是 https，先设 False
    # 生产环境如果用了 https，请改成 True
    JWT_COOKIE_SECURE = os.getenv("JWT_COOKIE_SECURE", "False").lower() == "true"

    # 同站点场景推荐 Lax
    JWT_COOKIE_SAMESITE = os.getenv("JWT_COOKIE_SAMESITE", "Lax")

    # 你的项目是同域网页应用，先关掉，避免你当前前端改造成本太高
    # 以后再加 CSRF 防护
    JWT_COOKIE_CSRF_PROTECT = False

    # cookie path
    JWT_ACCESS_COOKIE_PATH = "/"
    JWT_REFRESH_COOKIE_PATH = "/api/auth/refresh"
