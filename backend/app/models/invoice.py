from app.extensions import db


class Invoice(db.Model):
    __tablename__ = "invoices"

    id = db.Column(db.Integer, primary_key=True)

    invoice_number = db.Column(db.String(50), unique=True, nullable=False)

    request_id = db.Column(
        db.Integer,
        db.ForeignKey("service_requests.id"),
        unique=True,
        nullable=False
    )

    total_amount = db.Column(db.Numeric(12, 2), nullable=False)

    payment_status = db.Column(
        db.String(20), default="Unpaid", nullable=False
    )

    created_at = db.Column(
        db.DateTime(timezone=True), server_default=db.func.now()
    )

    request = db.relationship("ServiceRequest", back_populates="invoice")
    payments = db.relationship("Payment", back_populates="invoice")