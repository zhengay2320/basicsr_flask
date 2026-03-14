from app.extensions import db
from app.models.base import BaseModel


class AuditLog(BaseModel):
    __tablename__ = "audit_log"

    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("sys_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    action = db.Column(db.String(64), nullable=False)
    target_type = db.Column(db.String(64), nullable=False)
    target_id = db.Column(db.BigInteger, nullable=False)
    detail = db.Column(db.JSON, nullable=True)

    __table_args__ = (
        db.Index("idx_target", "target_type", "target_id"),
    )
