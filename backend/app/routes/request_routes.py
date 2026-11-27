import re
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.models.service import Service
from app.models.service_request import ServiceRequest
from app.models.request_item import RequestItem
from app.models.appointment_slot import AppointmentSlot
from app.models.user import User
from app.utils.booking_access import booking_actor, owned_requests
from app.utils.appointment_utils import (
    validate_slot, parse_optional_appointment, is_slot_available,
    serialize_appointment, cancel_request, lock_appointment_date
)

request_bp = Blueprint("service_request", __name__)


def error(message, status=400):
    return jsonify({"success": False, "message": message}), status


def can_hide_customer_request(req, now=None):
    """Only terminal requests at least 24 hours old may be hidden."""
    if req.customer_hidden_at is not None or req.created_at is None:
        return False
    created = req.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    now = now or datetime.now(timezone.utc)
    if now - created < timedelta(hours=24):
        return False
    invoice = req.invoice
    if invoice is not None:
        return invoice.deleted_at is not None or invoice.payment_status == "Paid"
    return req.status == "Cancelled"


@request_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    actor = booking_actor()
    if not actor:
        return error("Customer or active management access only", 403)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error("Invalid request body")
    name = str(data.get("customer_name") or "").strip()
    mobile = str(data.get("mobile") or "").strip()
    village = str(data.get("village") or "").strip()
    car_make = str(data.get("car_make") or data.get("car_name") or "").strip()
    car_number = str(data.get("car_number") or "").strip().upper().replace(" ", "")
    service_ids = data.get("service_ids", [])
    if not car_make or not car_number:
        return error("Car make and car number are required")
    if mobile and not re.fullmatch(r"[6-9][0-9]{9}", mobile):
        return error("Enter a valid mobile number")
    if len(name) > 100 or len(village) > 150 or len(car_make) > 100 or len(car_number) > 20:
        return error("Invalid customer or vehicle details")
    if not isinstance(service_ids, list) or not service_ids or any(type(s) is not int for s in service_ids):
        return error("Select services")
    service_ids = list(dict.fromkeys(service_ids))
    services = Service.query.filter(Service.id.in_(service_ids), Service.is_active.is_(True)).all()
    if len(services) != len(service_ids):
        return error("Invalid or inactive services")
    try:
        date, start, end = parse_optional_appointment(data.get("appointment_date"), data.get("preferred_start_time"))
    except (ValueError, TypeError, OverflowError):
        return error("Invalid appointment date or time")
    try:
        vehicle = Vehicle.query.filter_by(car_number=car_number).first()
        if actor.role == "management":
            customer = None
            if mobile:
                account = User.query.filter_by(mobile=mobile).first()
                if account and account.role != "customer":
                    return error("Enter the actual customer's mobile number", 409)
                customer = Customer.query.filter_by(mobile=mobile).with_for_update().first()
                if account and not customer:
                    return error("Customer account requires administrator review", 409)
            if vehicle:
                vehicle_customer = Customer.query.filter_by(id=vehicle.customer_id).with_for_update().first()
                if not vehicle_customer:
                    return error("Vehicle customer not found", 409)
                if customer and customer.id != vehicle.customer_id:
                    return error("Vehicle belongs to another customer", 409)
                if mobile and vehicle_customer.mobile and vehicle_customer.mobile != mobile:
                    return error("Vehicle belongs to another customer", 409)
                customer = vehicle_customer
            if not customer:
                customer = Customer(user_id=None, name=name or None, mobile=mobile or None, village=village or None, is_active=True)
                db.session.add(customer)
                db.session.flush()
            if not customer.is_active:
                return error("Customer is archived. Contact administrator.", 409)
            if customer.user_id is None:
                if name and not customer.name:
                    customer.name = name
                if mobile and not customer.mobile:
                    customer.mobile = mobile
                if village and not customer.village:
                    customer.village = village
        else:
            customer = Customer.query.filter_by(user_id=actor.id).first()
            if not customer:
                return error("Customer not found", 404)
            if not customer.is_active:
                return error("Customer account is archived", 403)
        if vehicle and vehicle.customer_id != customer.id:
            db.session.rollback()
            return error("Vehicle is registered to another customer", 409)
        if not vehicle:
            vehicle = Vehicle(customer_id=customer.id, car_name=car_make, car_number=car_number)
            db.session.add(vehicle)
            db.session.flush()
        req = ServiceRequest(customer_id=customer.id, vehicle_id=vehicle.id, created_by_user_id=actor.id,
                             booking_source="Management" if actor.role == "management" else "Customer", booking_name=name,
                             booking_mobile=mobile, booking_car_make=car_make, status="Pending",
                             appointment_date=date, preferred_start_time=start, preferred_end_time=end,
                             appointment_status="Pending" if date is not None and start is not None and end is not None else None)
        db.session.add(req)
        db.session.flush()
        for service_id in service_ids:
            db.session.add(RequestItem(request_id=req.id, service_id=service_id))
        db.session.commit()
        return jsonify({"success": True, "message": "Service request submitted successfully", "request_id": req.id, "customer_id": customer.id, "customer_name": req.contact_name, "booking_source": req.booking_source, "status": req.status, **serialize_appointment(req)}), 201
    except IntegrityError:
        db.session.rollback()
        return error("Unable to save service request", 409)


@request_bp.route("/my-requests", methods=["GET"])
@jwt_required()
def my_requests():
    actor = booking_actor()
    if not actor:
        return error("Customer or active management access only", 403)
    query = owned_requests(actor)
    if actor.role == "customer":
        query = query.filter(ServiceRequest.customer_hidden_at.is_(None))
    records = query.order_by(ServiceRequest.id.desc()).all()
    result = []
    for req in records:
        bill_deleted = req.invoice is not None and req.invoice.deleted_at is not None
        invoice = None if bill_deleted else req.invoice
        payment = max(invoice.payments, key=lambda item: item.id, default=None) if invoice else None
        result.append({
            "request_id": req.id, "customer_name": req.contact_name or "", "mobile": req.contact_mobile or "",
            "village": req.customer.village or "", "car_name": req.car_make, "car_make": req.car_make,
            "booking_source": req.booking_source,
            "car_number": req.vehicle.car_number, "status": "Bill Deleted" if bill_deleted else req.status, "created_at": req.created_at.isoformat(),
            "can_delete": actor.role == "customer" and can_hide_customer_request(req),
            **serialize_appointment(req),
            "invoice_id": invoice.id if invoice else None,
            "invoice_number": invoice.invoice_number if invoice else None,
            "subtotal": str(invoice.effective_subtotal) if invoice else None,
            "discount_amount": str(invoice.discount_amount) if invoice else None,
            "service_amount": str(invoice.service_amount) if invoice else None,
            "tip_amount": str(invoice.tip_amount) if invoice else None,
            "total_amount": str(invoice.total_amount) if invoice else None,
            "payment_status": invoice.payment_status if invoice else None,
            "requested_payment_method": invoice.requested_payment_method if invoice else None,
            "payment_requested_at": invoice.payment_requested_at.isoformat() if invoice and invoice.payment_requested_at else None,
            "payment_method": payment.payment_method if payment else None,
            "transaction_id": payment.transaction_id if payment else None,
            "paid_at": payment.paid_at.isoformat() if payment and payment.paid_at else None,
            "services": [{"service_id": item.service_id, "service_name": item.service.service_name,
                          "price": str(item.service.price) if item.service.price is not None else None,
                          "amount": str(item.amount) if item.amount is not None and not bill_deleted else None} for item in req.items],
        })
    return jsonify({"success": True, "data": result}), 200


@request_bp.route("/<int:request_id>", methods=["DELETE"])
@jwt_required()
def hide_my_request(request_id):
    actor = booking_actor()
    if not actor or actor.role != "customer":
        return error("Customer access only", 403)
    req = owned_requests(actor).filter(ServiceRequest.id == request_id).with_for_update().first()
    if not req:
        return error("Request not found", 404)
    if req.customer_hidden_at is not None:
        return jsonify({"success": True, "message": "Request already removed from your list"}), 200
    if not can_hide_customer_request(req):
        return error("Only cancelled, paid or bill-deleted requests at least 24 hours old can be removed", 409)
    try:
        req.customer_hidden_at = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify({"success": True, "message": "Request removed from My Requests", "request_id": req.id}), 200
    except IntegrityError:
        db.session.rollback()
        return error("Unable to remove request", 409)


@request_bp.route("/<int:request_id>/select-slot", methods=["POST"])
@jwt_required()
def select_slot(request_id):
    actor = booking_actor()
    if not actor:
        return error("Customer or active management access only", 403)
    req = owned_requests(actor).filter(ServiceRequest.id == request_id).with_for_update().first()
    if not req:
        return error("Request not found", 404)
    if req.appointment_status != "Reschedule Requested" or req.status != "Pending":
        return error("Slot selection is not available", 409)
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or type(data.get("slot_id")) is not int:
        return error("Invalid slot ID")
    slot = AppointmentSlot.query.filter_by(id=data["slot_id"], request_id=req.id, status="Available").first()
    if not slot:
        return error("Slot is not available", 404)
    try:
        lock_appointment_date(slot.appointment_date)
        validate_slot(slot.appointment_date.isoformat(), slot.start_time.strftime("%H:%M"), slot.end_time.strftime("%H:%M"))
    except (ValueError, TypeError):
        db.session.rollback()
        return error("Selected time slot has expired")
    if not is_slot_available(slot.appointment_date, slot.start_time, slot.end_time, req.id):
        db.session.rollback()
        return error("This slot has already been booked", 409)
    try:
        req.appointment_date = slot.appointment_date
        req.preferred_start_time = slot.start_time
        req.preferred_end_time = slot.end_time
        req.appointment_status = "Pending"
        for other in req.appointment_slots:
            other.status = "Selected" if other.id == slot.id else "Expired"
        db.session.commit()
        return jsonify({"success": True, "message": "Time slot selected. Waiting for admin confirmation.", **serialize_appointment(req)}), 200
    except IntegrityError:
        db.session.rollback()
        return error("Unable to select time slot", 409)


@request_bp.route("/<int:request_id>/cancel", methods=["POST"])
@jwt_required()
def cancel_my_request(request_id):
    actor = booking_actor()
    if not actor:
        return error("Customer or active management access only", 403)
    req = owned_requests(actor).filter(ServiceRequest.id == request_id).with_for_update().first()
    if not req:
        return error("Request not found", 404)
    data = request.get_json(silent=True)
    if data is not None and not isinstance(data, dict):
        return error("Invalid request body")
    reason = (data or {}).get("reason") or "Cancelled by requester"
    if not isinstance(reason, str) or len(reason) > 250:
        return error("Invalid cancellation reason")
    try:
        cancel_request(req, "Management" if actor.role == "management" else "Customer", reason.strip() or "Cancelled by requester")
        db.session.commit()
        return jsonify({"success": True, "message": "Request cancelled successfully", "request_id": req.id, "status": req.status, **serialize_appointment(req)}), 200
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc), 409)
    except IntegrityError:
        db.session.rollback()
        return error("Unable to cancel request", 409)
