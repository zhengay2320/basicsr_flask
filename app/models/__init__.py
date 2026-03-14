'''
只放数据库模型，每个核心实体一个文件，避免后面一个 models.py 巨大无比。
'''
from app.models.user import User
from app.models.task import Task
from app.models.task_config import TaskConfig
from app.models.task_run import TaskRun
from app.models.run_event import RunEvent
from app.models.run_metric import RunMetric
from app.models.run_artifact import RunArtifact
from app.models.notification import Notification
from app.models.compute_node import ComputeNode
from app.models.gpu_device import GPUDevice
from app.models.resource_snapshot import ResourceSnapshot
from app.models.audit_log import AuditLog
from app.models.task_config import TaskConfig

__all__ = [
    "User",
    "Task",
    "TaskConfig",
    "TaskRun",
    "RunEvent",
    "RunMetric",
    "RunArtifact",
    "Notification",
    "ComputeNode",
    "GPUDevice",
    "ResourceSnapshot",
    "AuditLog",
]
