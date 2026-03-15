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

    BASICSR_ROOT = os.getenv("BASICSR_ROOT", r"/home/ubuntu/data/zhenganyang/myMLPro")
    STORAGE_ROOT = os.getenv("STORAGE_ROOT", r"/home/ubuntu/data/zhenganyang/myMLPro/storage")
    PYTHON_EXEC = os.getenv("PYTHON_EXEC", r"/home/ubuntu/data/miniconda3/envs/zhengay/bin/python")

    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "False").lower() == "true"
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
