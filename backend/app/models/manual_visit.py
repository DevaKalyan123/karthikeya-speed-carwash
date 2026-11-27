from app.extensions import db


class ManualVisit(db.Model):
    """Historical service entered by an administrator, not an online invoice."""
    __tablename__ = "manual_visits"
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    service_date = db.Column(db.Date, nullable=False, index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=True)
    services = db.Column(db.JSON, nullable=False, default=list)
    vehicles_snapshot = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=db.func.now())
    __table_args__ = (db.CheckConstraint("amount IS NULL OR amount >= 0", name="ck_manual_visit_amount_nonnegative"),)

    customer = db.relationship("Customer", backref="manual_visits")

    def serialize(self):
        return {
            "manual_visit_id": self.id,
            "request_id": None,
            "source": "Manual",
            "service_date": self.service_date.isoformat(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "car_name": ", ".join(v.get("car_make") or "" for v in self.vehicles_snapshot if v.get("car_make")),
            "car_number": ", ".join(v.get("car_number") or "" for v in self.vehicles_snapshot if v.get("car_number")),
            "services": self.services,
            "status": "Paid (Manual)" if self.amount is not None else "Manual Record",
            "total_amount": str(self.amount) if self.amount is not None else None,
        }
