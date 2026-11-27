from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.service_request import ServiceRequest
from app.routes.admin_routes import admin_required
from app.utils.booking_access import booking_actor, owned_requests

payment_bp = Blueprint("payment", __name__)


def error(message, status=400):
    return jsonify({"success": False, "message": message}), status


@payment_bp.route("/<int:invoice_id>/select-method", methods=["POST"])
@jwt_required()
def select_payment_method(invoice_id):
    actor = booking_actor()
    if not actor:
        return error("Customer or active management access only", 403)
    request_ids = owned_requests(actor).with_entities(ServiceRequest.id)
    invoice = Invoice.query.filter(Invoice.id == invoice_id, Invoice.request_id.in_(request_ids), Invoice.deleted_at.is_(None)).with_for_update().first()
    if not invoice:
        return error("Invoice not found", 404)
    if invoice.request.status == "Cancelled" or invoice.payment_status != "Unpaid":
        return error("Payment selection is not available", 409)
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or data.get("payment_method") not in ("Cash", "UPI"):
        return error("Select Cash or UPI")
    try:
        raw_tip = data.get("tip_amount", "0.00")
        if raw_tip is None or raw_tip == "":
            raw_tip = "0.00"
        tip = Decimal(str(raw_tip))
        limit = Decimal("9999999999.99")
        if not tip.is_finite() or tip < 0 or tip > limit or tip != tip.quantize(Decimal("0.01")):
            raise ValueError()
        service_amount = invoice.service_amount
        total = service_amount + tip
        if total > limit:
            raise ValueError()
    except (ValueError, InvalidOperation, TypeError):
        return error("Enter a valid optional tip (non-negative, up to two decimal places, within total limit)")
    try:
        invoice.tip_amount = tip
        invoice.total_amount = total
        invoice.requested_payment_method = data["payment_method"]
        invoice.payment_status = "Awaiting Confirmation"
        invoice.payment_requested_at = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify({"success": True, "message": "Payment request sent to admin", "invoice_id": invoice.id,
                        "invoice_number": invoice.invoice_number, "subtotal": str(invoice.effective_subtotal),
                        "discount_amount": str(invoice.discount_amount), "service_amount": str(invoice.service_amount),
                        "tip_amount": str(invoice.tip_amount), "total_amount": str(invoice.total_amount),
                        "requested_payment_method": invoice.requested_payment_method, "payment_status": invoice.payment_status}), 200
    except IntegrityError:
        db.session.rollback()
        return error("Unable to submit payment request", 409)


@payment_bp.route("/admin/pending", methods=["GET"])
@admin_required
def get_pending_payments():
    invoices = Invoice.query.filter_by(payment_status="Awaiting Confirmation", deleted_at=None).order_by(Invoice.payment_requested_at.desc()).all()
    result = []
    for invoice in invoices:
        req = invoice.request
        paid = sum((p.amount for p in invoice.payments), Decimal("0.00"))
        result.append({"invoice_id": invoice.id, "invoice_number": invoice.invoice_number, "request_id": req.id,
                       "customer_name": req.contact_name, "mobile": req.contact_mobile, "car_name": req.car_make,
                       "car_number": req.vehicle.car_number, "booking_source": req.booking_source,
                       "subtotal": str(invoice.effective_subtotal), "discount_amount": str(invoice.discount_amount),
                       "service_amount": str(invoice.service_amount), "tip_amount": str(invoice.tip_amount),
                       "total_amount": str(invoice.total_amount), "balance_amount": str(invoice.total_amount - paid),
                       "requested_payment_method": invoice.requested_payment_method, "payment_status": invoice.payment_status,
                       "payment_requested_at": invoice.payment_requested_at.isoformat() if invoice.payment_requested_at else None})
    return jsonify({"success": True, "total": len(result), "data": result}), 200


@payment_bp.route("/<int:invoice_id>/pay", methods=["POST"])
@admin_required
def record_payment(invoice_id):
    invoice = Invoice.query.filter_by(id=invoice_id, deleted_at=None).with_for_update().first()
    if not invoice:
        return error("Invoice not found", 404)
    if invoice.payment_status == "Paid":
        return error("Invoice already paid", 409)
    if invoice.payment_status != "Awaiting Confirmation" or invoice.request.status == "Cancelled":
        return error("Waiting for customer payment selection", 409)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error("Invalid request body")
    method = invoice.requested_payment_method
    if method not in ("Cash", "UPI") or data.get("payment_method", method) != method:
        return error("Payment method does not match customer selection")
    paid = sum((p.amount for p in invoice.payments), Decimal("0.00"))
    balance = invoice.total_amount - paid
    if balance <= 0:
        return error("No outstanding balance", 409)
    try:
        amount = Decimal(str(data.get("amount")))
        if not amount.is_finite() or amount <= 0 or amount > Decimal("9999999999.99") or amount != amount.quantize(Decimal("0.01")):
            raise ValueError()
    except (ValueError, InvalidOperation, TypeError):
        return error("Enter a valid received amount")
    if amount != balance:
        return error(f"Received amount must be {balance:.2f}")
    transaction_id = data.get("transaction_id")
    if method == "UPI":
        if not isinstance(transaction_id, str) or not transaction_id.strip() or len(transaction_id.strip()) > 100:
            return error("Valid UPI transaction reference is required")
        transaction_id = transaction_id.strip()
        if Payment.query.filter_by(transaction_id=transaction_id).first():
            return error("Transaction ID already exists", 409)
    else:
        transaction_id = None
    try:
        payment = Payment(invoice_id=invoice.id, amount=amount, payment_method=method, transaction_id=transaction_id)
        db.session.add(payment)
        invoice.payment_status = "Paid"
        db.session.commit()
        return jsonify({"success": True, "message": "Payment confirmed and bill closed successfully", "invoice_id": invoice.id,
                        "invoice_number": invoice.invoice_number, "subtotal": str(invoice.effective_subtotal),
                        "discount_amount": str(invoice.discount_amount), "service_amount": str(invoice.service_amount),
                        "tip_amount": str(invoice.tip_amount), "total_amount": str(invoice.total_amount),
                        "paid_amount": str(payment.amount), "payment_method": payment.payment_method,
                        "payment_status": invoice.payment_status, "transaction_id": payment.transaction_id}), 201
    except IntegrityError:
        db.session.rollback()
        return error("Payment could not be recorded", 409)


@payment_bp.route("/<int:invoice_id>/reject", methods=["POST"])
@admin_required
def reject_payment(invoice_id):
    invoice = Invoice.query.filter_by(id=invoice_id, deleted_at=None).with_for_update().first()
    if not invoice:
        return error("Invoice not found", 404)
    if invoice.payment_status != "Awaiting Confirmation":
        return error("No pending payment request", 409)
    # Remove only an unconfirmed tip; never alter a recorded payment.
    service_amount = invoice.service_amount
    paid = sum((p.amount for p in invoice.payments), Decimal("0.00"))
    if paid > service_amount:
        return error("Recorded payments exceed the service amount; reconcile the invoice before rejecting", 409)
    try:
        invoice.total_amount = service_amount
        invoice.tip_amount = Decimal("0.00")
        invoice.payment_status = "Unpaid"
        invoice.requested_payment_method = None
        invoice.payment_requested_at = None
        db.session.commit()
        return jsonify({"success": True, "message": "Payment request rejected. Customer can select again.", "payment_status": invoice.payment_status, "service_amount": str(invoice.service_amount), "tip_amount": str(invoice.tip_amount), "total_amount": str(invoice.total_amount)}), 200
    except IntegrityError:
        db.session.rollback()
        return error("Unable to reject payment request", 409)
