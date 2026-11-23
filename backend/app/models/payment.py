from app.extensions import db


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)

    invoice_id = db.Column(
        db.Integer, db.ForeignKey("invoices.id"), nullable=False
    )

    amount = db.Column(db.Numeric(12, 2), nullable=False)
    payment_method = db.Column(db.String(30), nullable=False)
    transaction_id = db.Column(db.String(100), unique=True)

    paid_at = db.Column(
        db.DateTime(timezone=True), server_default=db.func.now()
    )

    invoice = db.relationship("Invoice", back_populates="payments")

    __table_args__ = (
        db.CheckConstraint("amount > 0", name="check_payment_amount"),
    )