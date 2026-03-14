from app.extensions import db
from app.models.base import BaseModel


class TaskRun(BaseModel):
    __tablename__ = "task_run"

    task_id = db.Column(
        db.BigInteger,
        db.ForeignKey("dl_task.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("sys_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    config_id = db.Column(
        db.BigInteger,
        db.ForeignKey("task_config.id", ondelete="RESTRICT"),
        nullable=False
    )

    run_name = db.Column(db.String(128), nullable=True)
    run_type = db.Column(db.String(32), nullable=False)  # train / test / resume
    status = db.Column(db.String(32), nullable=False, default="pending")
    trigger_type = db.Column(db.String(32), nullable=False, default="manual")

    run_config_path = db.Column(db.String(255), nullable=False)
    work_dir = db.Column(db.String(255), nullable=False)
    log_dir = db.Column(db.String(255), nullable=False)
    checkpoint_dir = db.Column(db.String(255), nullable=True)
    output_dir = db.Column(db.String(255), nullable=True)
    tensorboard_dir = db.Column(db.String(255), nullable=True)

    command_text = db.Column(db.Text, nullable=False)

    process_pid = db.Column(db.Integer, nullable=True)
    exit_code = db.Column(db.Integer, nullable=True)

    gpu_mode = db.Column(db.String(32), nullable=False)  # single / multi / cpu
    gpu_devices = db.Column(db.String(128), nullable=True)  # e.g. "0,1"
    node_id = db.Column(
        db.BigInteger,
        db.ForeignKey("compute_node.id", ondelete="SET NULL"),
        nullable=True
    )

    started_at = db.Column(db.DateTime, nullable=True)
    ended_at = db.Column(db.DateTime, nullable=True)
    duration_seconds = db.Column(db.Integer, nullable=True)

    error_message = db.Column(db.Text, nullable=True)

    events = db.relationship("RunEvent", backref="run", lazy=True, cascade="all, delete-orphan")
    metrics = db.relationship("RunMetric", backref="run", lazy=True, cascade="all, delete-orphan")
    artifacts = db.relationship("RunArtifact", backref="run", lazy=True, cascade="all, delete-orphan")

    resume_from = db.Column(db.String(255), nullable=True)
    parent_run_id = db.Column(
        db.BigInteger,
        db.ForeignKey("task_run.id", ondelete="SET NULL"),
        nullable=True
    )

    metric_summary_json = db.Column(db.JSON, nullable=True)
    best_metric_max_json = db.Column(db.JSON, nullable=True)
    best_metric_min_json = db.Column(db.JSON, nullable=True)


