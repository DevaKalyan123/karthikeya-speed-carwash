from flask import Blueprint, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.service_request import ServiceRequest
from app.utils.invoice_pdf import generate_invoice_pdf
from app.utils.booking_access import booking_actor, can_access_booking

invoice_bp = Blueprint("invoice", __name__)


@invoice_bp.route("/my-invoices", methods=["GET"])
@jwt_required()
def my_invoices():
    actor = booking_actor()
    if not actor:
        return jsonify({"success": False, "message": "Customer or active management access only"}), 403
    query = Invoice.query.join(ServiceRequest).filter(ServiceRequest.status != "Cancelled", Invoice.payment_status == "Paid", Invoice.deleted_at.is_(None))
    if actor.role == "management":
        query = query.filter(ServiceRequest.created_by_user_id == actor.id, ServiceRequest.booking_source == "Management")
    else:
        customer = Customer.query.filter_by(user_id=actor.id).first()
        if not customer:
            return jsonify({"success": False, "message": "Customer not found"}), 404
        query = query.filter(ServiceRequest.customer_id == customer.id)
    invoices = query.order_by(Invoice.id.desc()).all()
    result = []
    for invoice in invoices:
        req = invoice.request
        payment = max(invoice.payments, key=lambda item: item.id, default=None)
        result.append({
            "invoice_id": invoice.id, "invoice_number": invoice.invoice_number, "request_id": invoice.request_id,
            "customer_name": req.contact_name, "mobile": req.contact_mobile, "village": req.customer.village,
            "car_make": req.car_make, "car_name": req.car_make, "car_number": req.vehicle.car_number,
            "booking_source": req.booking_source,
            "appointment_date": req.appointment_date.isoformat() if req.appointment_date else None,
            "appointment_time": req.confirmed_start_time.strftime("%H:%M") if req.confirmed_start_time else None,
            "appointment_status": req.appointment_status or "Not Scheduled",
            "subtotal": str(invoice.effective_subtotal), "discount_amount": str(invoice.discount_amount),
            "service_amount": str(invoice.service_amount), "tip_amount": str(invoice.tip_amount),
            "total_amount": str(invoice.total_amount), "payment_status": invoice.payment_status,
            "payment_method": payment.payment_method if payment else ("No Payment Required" if invoice.total_amount == 0 else None),
            "transaction_id": payment.transaction_id if payment else None,
            "paid_at": payment.paid_at.isoformat() if payment and payment.paid_at else None,
            "created_at": invoice.created_at.isoformat(),
            "services": [{"service_id": item.service_id, "service_name": item.service.service_name,
                          "amount": str(item.amount) if item.amount is not None else None} for item in req.items]
        })
    return jsonify({"success": True, "total": len(result), "data": result}), 200


@invoice_bp.route("/<int:invoice_id>/download", methods=["GET"])
@jwt_required()
def download_invoice(invoice_id):
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active:
        return jsonify({"success": False, "message": "Access denied"}), 403
    invoice = db.session.get(Invoice, invoice_id)
    if not invoice or invoice.deleted_at is not None:
        return jsonify({"success": False, "message": "Invoice not found"}), 404
    if user.role != "admin":
        actor = booking_actor()
        if not actor or not can_access_booking(actor, invoice.request):
            return jsonify({"success": False, "message": "Access denied"}), 403
        if invoice.payment_status != "Paid":
            return jsonify({"success": False, "message": "Complete payment to download invoice"}), 409
    if invoice.request.status == "Cancelled":
        return jsonify({"success": False, "message": "Request has been cancelled"}), 409
    return send_file(generate_invoice_pdf(invoice), mimetype="application/pdf", as_attachment=True,
                     download_name=f"{invoice.invoice_number}.pdf")
