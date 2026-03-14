import os


class DefaultConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "replace-this-secret")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URI",
        "mysql+pymysql://root:cohy453765348@127.0.0.1:3306/basicsr_platform?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_AS_ASCII = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "replace-this-jwt-secret")

    # 这里改成你的BasicSR项目根目录
    BASICSR_ROOT = os.getenv("BASICSR_ROOT", r"E:\myMLPro")

    # 平台自己存配置、日志、run 目录的根目录
    STORAGE_ROOT = os.getenv("STORAGE_ROOT", r"E:\myMLPro\storage")

    # Python 解释器
    PYTHON_EXEC = os.getenv("PYTHON_EXEC", r"D:\ProgramData\Anaconda3\envs\zhengay\python")
