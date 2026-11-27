from decimal import Decimal
from app.extensions import db


class Invoice(db.Model):
    __tablename__ = "invoices"

    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    request_id = db.Column(db.Integer, db.ForeignKey("service_requests.id"), unique=True, nullable=False)
    subtotal = db.Column(db.Numeric(12, 2), nullable=True)
    discount_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0, server_default="0")
    tip_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0, server_default="0")
    # Final payable amount, including the optional tip.
    total_amount = db.Column(db.Numeric(12, 2), nullable=False)
    payment_status = db.Column(db.String(30), default="Unpaid", nullable=False)
    requested_payment_method = db.Column(db.String(30), nullable=True)
    payment_requested_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True, index=True)
    deleted_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    request = db.relationship("ServiceRequest", back_populates="invoice")
    payments = db.relationship("Payment", back_populates="invoice")

    __table_args__ = (db.CheckConstraint("tip_amount >= 0 AND tip_amount <= total_amount", name="check_invoice_tip_amount"),)

    @property
    def service_amount(self):
        return self.total_amount - (self.tip_amount or Decimal("0.00"))

    @property
    def effective_subtotal(self):
        return self.subtotal if self.subtotal is not None else self.service_amount + self.discount_amount
