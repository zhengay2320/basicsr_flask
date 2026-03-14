from app.extensions import db
from app.models.base import BaseModel


class RunMetric(BaseModel):
    __tablename__ = "run_metric"

    run_id = db.Column(
        db.BigInteger,
        db.ForeignKey("task_run.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    metric_name = db.Column(db.String(64), nullable=False)
    step = db.Column(db.BigInteger, nullable=False)
    epoch = db.Column(db.Integer, nullable=True)
    value = db.Column(db.Float, nullable=False)
    metric_time = db.Column(db.DateTime, nullable=False)

    __table_args__ = (
        db.Index("idx_run_metric", "run_id", "metric_name", "step"),
    )
