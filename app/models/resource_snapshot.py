from app.extensions import db
from app.models.base import BaseModel


class ResourceSnapshot(BaseModel):
    __tablename__ = "resource_snapshot"

    node_id = db.Column(
        db.BigInteger,
        db.ForeignKey("compute_node.id", ondelete="CASCADE"),
        nullable=False
    )
    run_id = db.Column(
        db.BigInteger,
        db.ForeignKey("task_run.id", ondelete="SET NULL"),
        nullable=True
    )

    cpu_usage = db.Column(db.Float, nullable=True)
    memory_usage = db.Column(db.Float, nullable=True)
    gpu_index = db.Column(db.Integer, nullable=True)
    gpu_usage = db.Column(db.Float, nullable=True)
    gpu_memory_used_mb = db.Column(db.Integer, nullable=True)
    gpu_temperature = db.Column(db.Integer, nullable=True)
    snapshot_time = db.Column(db.DateTime, nullable=False)

    __table_args__ = (
        db.Index("idx_node_time", "node_id", "snapshot_time"),
        db.Index("idx_run_time", "run_id", "snapshot_time"),
    )
