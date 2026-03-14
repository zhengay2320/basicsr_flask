from datetime import datetime
from app.extensions import db


class TimestampMixin:
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )


class SoftDeleteMixin:
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)


class BaseModel(db.Model, TimestampMixin):
    __abstract__ = True

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    def to_dict(self):
        result = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                result[column.name] = value.isoformat()
            else:
                result[column.name] = value
        return result
