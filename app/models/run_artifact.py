from app.extensions import db
from app.models.base import BaseModel


class RunArtifact(BaseModel):
    __tablename__ = "run_artifact"

    run_id = db.Column(
        db.BigInteger,
        db.ForeignKey("task_run.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    artifact_type = db.Column(db.String(64), nullable=False, index=True)
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False, default=0)
    is_best = db.Column(db.Boolean, nullable=False, default=False)
