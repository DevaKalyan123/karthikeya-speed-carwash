from app.extensions import db


class RequestItem(db.Model):
    __tablename__ = "request_items"

    id = db.Column(db.Integer, primary_key=True)

    request_id = db.Column(
        db.Integer, db.ForeignKey("service_requests.id"), nullable=False
    )

    service_id = db.Column(
        db.Integer, db.ForeignKey("services.id"), nullable=False
    )

    amount = db.Column(db.Numeric(12, 2), nullable=True)

    request = db.relationship("ServiceRequest", back_populates="items")
    service = db.relationship("Service")

    __table_args__ = (
        db.UniqueConstraint("request_id", "service_id"),
        db.CheckConstraint("amount >= 0", name="check_service_amount"),
    )