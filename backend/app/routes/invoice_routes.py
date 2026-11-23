from flask import Blueprint, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.user import User
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.service_request import ServiceRequest
from app.utils.invoice_pdf import generate_invoice_pdf


invoice_bp = Blueprint("invoice", __name__)


# Customer Invoices
@invoice_bp.route("/my-invoices", methods=["GET"])
@jwt_required()
def my_invoices():

    user_id = int(get_jwt_identity())

    customer = Customer.query.filter_by(
        user_id=user_id
    ).first()

    if not customer:
        return jsonify({
            "success": False,
            "message": "Customer not found"
        }), 404

    invoices = Invoice.query.join(
        ServiceRequest
    ).filter(
        ServiceRequest.customer_id == customer.id
    ).order_by(
        Invoice.id.desc()
    ).all()

    result = []

    for invoice in invoices:

        req = invoice.request

        result.append({
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "request_id": invoice.request_id,
            "customer_name": req.customer.name,
            "car_name": req.vehicle.car_name,
            "car_number": req.vehicle.car_number,
            "total_amount": str(invoice.total_amount),
            "payment_status": invoice.payment_status,
            "created_at": invoice.created_at.isoformat(),
            "services": [
                {
                    "service_name": item.service.service_name,
                    "amount": str(item.amount)
                }
                for item in req.items
            ]
        })

    return jsonify({
        "success": True,
        "data": result
    }), 200


# Download PDF Invoice
@invoice_bp.route("/<int:invoice_id>/download", methods=["GET"])
@jwt_required()
def download_invoice(invoice_id):

    user_id = int(get_jwt_identity())

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404

    invoice = db.session.get(Invoice, invoice_id)

    if not invoice:
        return jsonify({
            "success": False,
            "message": "Invoice not found"
        }), 404

    if user.role != "admin":

        if (
            user.role != "customer"
            or invoice.request.customer.user_id != user_id
        ):
            return jsonify({
                "success": False,
                "message": "Access denied"
            }), 403

    pdf = generate_invoice_pdf(invoice)

    return send_file(
        pdf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{invoice.invoice_number}.pdf"
    )