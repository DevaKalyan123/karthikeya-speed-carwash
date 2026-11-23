from decimal import Decimal
from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.routes.admin_routes import admin_required

payment_bp = Blueprint("payment", __name__)


@payment_bp.route("/<int:invoice_id>/pay", methods=["POST"])
@admin_required
def record_payment(invoice_id):

    invoice = Invoice.query.filter_by(
        id=invoice_id
    ).with_for_update().first()

    if not invoice:
        return jsonify({
            "success": False,
            "message": "Invoice not found"
        }), 404

    if invoice.payment_status == "Paid":
        return jsonify({
            "success": False,
            "message": "Invoice already paid"
        }), 409

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Invalid request body"
        }), 400

    payment_method = data.get("payment_method")
    transaction_id = data.get("transaction_id")

    if payment_method not in ["Cash", "UPI", "Card"]:
        return jsonify({
            "success": False,
            "message": "Invalid payment method"
        }), 400

    if payment_method != "Cash":

        if not isinstance(transaction_id, str) or not transaction_id.strip():
            return jsonify({
                "success": False,
                "message": "Transaction ID is required"
            }), 400

        transaction_id = transaction_id.strip()

        if len(transaction_id) > 100:
            return jsonify({
                "success": False,
                "message": "Invalid transaction ID"
            }), 400

    else:
        transaction_id = None

    paid_amount = sum(
        (payment.amount for payment in invoice.payments),
        Decimal("0.00")
    )

    balance = invoice.total_amount - paid_amount

    if balance <= 0:
        return jsonify({
            "success": False,
            "message": "No outstanding balance"
        }), 409

    try:

        payment = Payment(
            invoice_id=invoice.id,
            amount=balance,
            payment_method=payment_method,
            transaction_id=transaction_id
        )

        db.session.add(payment)

        invoice.payment_status = "Paid"

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Payment recorded successfully",
            "invoice_number": invoice.invoice_number,
            "paid_amount": str(payment.amount),
            "payment_method": payment.payment_method,
            "payment_status": invoice.payment_status
        }), 201

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Payment could not be recorded"
        }), 409