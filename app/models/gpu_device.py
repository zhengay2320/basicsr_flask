from app.extensions import db
from app.models.base import BaseModel


class GPUDevice(BaseModel):
    __tablename__ = "gpu_device"

    node_id = db.Column(
        db.BigInteger,
        db.ForeignKey("compute_node.id", ondelete="CASCADE"),
        nullable=False
    )
    gpu_index = db.Column(db.Integer, nullable=False)
    gpu_name = db.Column(db.String(128), nullable=False)
    total_memory_mb = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(32), nullable=False, default="idle")
    current_run_id = db.Column(
        db.BigInteger,
        db.ForeignKey("task_run.id", ondelete="SET NULL"),
        nullable=True
    )
    last_report_time = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.UniqueConstraint("node_id", "gpu_index", name="uk_node_gpu"),
    )
