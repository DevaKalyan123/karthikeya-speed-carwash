import re
from datetime import datetime, timedelta, timezone

from decimal import Decimal, InvalidOperation
from functools import wraps
from io import BytesIO

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

from app.extensions import db
from app.models.user import User
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.models.service_request import ServiceRequest
from app.models.invoice import Invoice
from app.models.appointment_slot import AppointmentSlot
from app.models.manual_visit import ManualVisit
from app.models.service import Service

from app.utils.appointment_utils import (
    validate_slot,
    lock_appointment_date,
    is_slot_available,
    serialize_appointment,
    cancel_request
)


admin_bp = Blueprint("admin", __name__)


# ==========================================
# ADMIN AUTHORIZATION
# ==========================================

def admin_required(fn):

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):

        user = db.session.get(
            User, int(get_jwt_identity())
        )

        if not user or not user.is_active or user.role != "admin":

            return jsonify({
                "success": False,
                "message": "Admin access only"
            }), 403

        return fn(*args, **kwargs)

    return wrapper


# ==========================================
# REQUEST DETAILS
# ==========================================

def serialize_request(req):

    bill_deleted = req.invoice is not None and req.invoice.deleted_at is not None
    invoice = None if bill_deleted else req.invoice

    payments = invoice.payments if invoice else []
    paid_amount = sum((p.amount for p in payments), Decimal("0.00"))
    payment = max(payments, key=lambda p: p.id, default=None)

    return {

        "request_id": req.id,

        "customer_id": req.customer_id,
        "booking_source": req.booking_source,
        "created_by_user_id": req.created_by_user_id,
        "booked_by_name": req.created_by_user.name if req.created_by_user else None,

        "customer_name": req.contact_name,

        "mobile": req.contact_mobile,

        "village": req.customer.village,

        "car_name": req.car_make,
        "car_make": req.car_make,

        "car_number": req.vehicle.car_number,

        "status": "Bill Deleted" if bill_deleted else req.status,

        "created_at": req.created_at.isoformat(),

        # Appointment Details
        **serialize_appointment(req),

        # Selected Services
        "services": [
            {
                "item_id": item.id,

                "service_id": item.service_id,

                "service_name": item.service.service_name,

                "price": (
                    str(item.service.price)
                    if item.service.price is not None
                    else None
                ),

                "amount": (
                    str(item.amount)
                    if item.amount is not None and not bill_deleted
                    else None
                )
            }
            for item in req.items
        ],

        # Invoice Details
        "invoice_id": (
            invoice.id if invoice else None
        ),

        "invoice_number": (
            invoice.invoice_number
            if invoice else None
        ),

        "subtotal": (
            str(invoice.effective_subtotal)
            if invoice else None
        ),

        "discount_amount": (
            str(invoice.discount_amount)
            if invoice else None
        ),

        "total_amount": (
            str(invoice.total_amount)
            if invoice else None
        ),
        "service_amount": str(invoice.service_amount) if invoice else None,
        "tip_amount": str(invoice.tip_amount) if invoice else None,

        "payment_status": (
            invoice.payment_status
            if invoice else None
        ),
        "requested_payment_method": (
            invoice.requested_payment_method if invoice else None
        ),
        "payment_requested_at": (
            invoice.payment_requested_at.isoformat()
            if invoice and invoice.payment_requested_at else None
        ),
        "paid_amount": str(paid_amount) if invoice else None,
        "balance_amount": (
            str(invoice.total_amount - paid_amount) if invoice else None
        ),
        "payment_method": payment.payment_method if payment else None,
        "transaction_id": payment.transaction_id if payment else None,
        "paid_at": (
            payment.paid_at.isoformat() if payment and payment.paid_at else None
        )
    }


# ==========================================
# GET ALL CUSTOMER REQUESTS
# ==========================================

@admin_bp.route("/requests", methods=["GET"])
@admin_required
def get_all_requests():

    status = request.args.get("status")

    appointment_status = request.args.get(
        "appointment_status"
    )

    query = ServiceRequest.query.filter(ServiceRequest.status != "Cancelled")

    if status:

        if status == "Bill Deleted":
            query = query.filter(ServiceRequest.invoice.has(Invoice.deleted_at.isnot(None)))
        elif status == "Billed":
            query = query.filter(ServiceRequest.status == "Billed", ServiceRequest.invoice.has(Invoice.deleted_at.is_(None)))
        else:
            query = query.filter(ServiceRequest.status == status)

    if appointment_status:

        query = query.filter_by(
            appointment_status=appointment_status
        )

    payment_status = request.args.get("payment_status")
    if payment_status:
        query = query.join(Invoice).filter(
            Invoice.payment_status == payment_status,
            Invoice.deleted_at.is_(None)
        )

    records = query.order_by(
        ServiceRequest.id.desc()
    ).all()

    return jsonify({
        "success": True,

        "total": len(records),

        "data": [
            serialize_request(req)
            for req in records
        ]

    }), 200


@admin_bp.route("/invoices", methods=["GET"])
@admin_required
def get_active_invoices():
    invoices = Invoice.query.filter(Invoice.deleted_at.is_(None)).order_by(Invoice.id.desc()).all()
    return jsonify({"success": True, "total": len(invoices),
                    "data": [serialize_request(invoice.request) for invoice in invoices]}), 200


@admin_bp.route("/invoices/<int:invoice_id>", methods=["DELETE"])
@admin_required
def delete_invoice(invoice_id):
    invoice = Invoice.query.filter(Invoice.id == invoice_id).with_for_update().first()
    if invoice is None or invoice.deleted_at is not None:
        return jsonify({"success": False, "message": "Active invoice not found"}), 404
    try:
        invoice.deleted_at = datetime.now(timezone.utc)
        invoice.deleted_by_user_id = int(get_jwt_identity())
        db.session.commit()
        return jsonify({"success": True, "message": "Bill removed; original financial record preserved"}), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "message": "Unable to remove bill"}), 409


@admin_bp.route("/invoices/all", methods=["DELETE"])
@admin_required
def delete_all_invoices():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or data.get("confirmation") != "DELETE ALL" or type(data.get("expected_count")) is not int or data["expected_count"] < 1:
        return jsonify({"success": False, "message": "Explicit confirmation and active invoice count required"}), 400
    expected_ids = data.get("expected_ids")
    if not isinstance(expected_ids, list) or any(type(value) is not int for value in expected_ids) or len(set(expected_ids)) != data["expected_count"] or len(expected_ids) != data["expected_count"]:
        return jsonify({"success": False, "message": "Active invoice IDs required; refresh the billing list"}), 400
    try:
        # Lock active invoices in a consistent order; payment actions use row locks too.
        invoices = Invoice.query.filter(Invoice.deleted_at.is_(None)).order_by(Invoice.id).with_for_update().all()
        if {invoice.id for invoice in invoices} != set(expected_ids):
            db.session.rollback()
            return jsonify({"success": False, "message": "Billing records changed. Refresh and confirm again."}), 409
        now = datetime.now(timezone.utc)
        actor_id = int(get_jwt_identity())
        for invoice in invoices:
            invoice.deleted_at = now
            invoice.deleted_by_user_id = actor_id
        db.session.commit()
        return jsonify({"success": True, "message": "Generated bills removed. Manual revenue preserved.", "deleted_count": len(invoices)}), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "message": "Unable to remove bills"}), 409


# ==========================================
# GET PARTICULAR REQUEST
# ==========================================

@admin_bp.route(
    "/requests/<int:request_id>",
    methods=["GET"]
)
@admin_required
def get_request(request_id):

    req = db.session.get(
        ServiceRequest, request_id
    )

    if not req:

        return jsonify({
            "success": False,
            "message": "Request not found"
        }), 404

    return jsonify({

        "success": True,

        "data": serialize_request(req)

    }), 200


# ==========================================
# CANCEL APPOINTMENT (ADMIN / NO-SHOW)
# ==========================================

@admin_bp.route("/requests/<int:request_id>/cancel", methods=["POST"])
@admin_required
def cancel_admin_request(request_id):
    req = ServiceRequest.query.filter_by(id=request_id).with_for_update().first()
    if not req:
        return jsonify({"success": False, "message": "Request not found"}), 404

    data = request.get_json(silent=True)
    if data is not None and not isinstance(data, dict):
        return jsonify({"success": False, "message": "Invalid request body"}), 400
    reason = (data or {}).get("reason") or "Cancelled by admin"
    if not isinstance(reason, str) or len(reason) > 250:
        return jsonify({"success": False, "message": "Invalid cancellation reason"}), 400

    try:
        cancel_request(req, "Admin", reason.strip() or "Cancelled by admin")
        db.session.commit()
        return jsonify({"success": True, "message": "Request cancelled successfully", "data": serialize_request(req)}), 200
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": str(exc)}), 409
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "message": "Unable to cancel request"}), 409


# ==========================================
# ACCEPT APPOINTMENT
# ==========================================

@admin_bp.route(
    "/requests/<int:request_id>/accept",
    methods=["POST"]
)
@admin_required
def accept_appointment(request_id):

    req = ServiceRequest.query.filter_by(
        id=request_id
    ).with_for_update().first()

    if not req:

        return jsonify({
            "success": False,
            "message": "Request not found"
        }), 404

    # Validate Request Status
    if (
        req.status != "Pending"
        or req.appointment_status != "Pending"
    ):

        return jsonify({
            "success": False,
            "message": "Appointment is not pending approval"
        }), 409

    # Validate Date and Time
    try:

        validate_slot(

            req.appointment_date.isoformat(),

            req.preferred_start_time.strftime("%H:%M"),

            req.preferred_end_time.strftime("%H:%M"),
            allow_past=True
        )

    except (ValueError, TypeError, AttributeError):

        return jsonify({
            "success": False,
            "message": "Invalid or expired appointment time"
        }), 400

    try:

        # Prevent Concurrent Conflicting Bookings
        lock_appointment_date(
            req.appointment_date
        )

        # Recheck time after acquiring lock
        validate_slot(
            req.appointment_date.isoformat(),
            req.preferred_start_time.strftime("%H:%M"),
            req.preferred_end_time.strftime("%H:%M"),
            allow_past=True
        )

        # Check Time Slot Availability
        if not is_slot_available(

            req.appointment_date,

            req.preferred_start_time,

            req.preferred_end_time,

            req.id
        ):

            db.session.rollback()

            return jsonify({
                "success": False,
                "message": (
                    "Time slot already booked. "
                    "Suggest alternative slots."
                )
            }), 409

        # Confirm Appointment
        req.confirmed_start_time = (
            req.preferred_start_time
        )

        req.confirmed_end_time = (
            req.preferred_end_time
        )

        req.appointment_status = "Confirmed"

        # Expire Unused Alternative Slots
        for slot in req.appointment_slots:

            if slot.status == "Available":

                slot.status = "Expired"

        db.session.commit()

        return jsonify({

            "success": True,

            "message": "Appointment confirmed successfully",

            "data": serialize_request(req)

        }), 200

    except ValueError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Appointment time has expired"
        }), 400

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to confirm appointment"
        }), 409


# ==========================================
# SUGGEST ALTERNATIVE TIME SLOTS
# ==========================================

@admin_bp.route(
    "/requests/<int:request_id>/suggest-slots",
    methods=["POST"]
)
@admin_required
def suggest_slots(request_id):

    req = ServiceRequest.query.filter_by(
        id=request_id
    ).with_for_update().first()

    if not req:

        return jsonify({
            "success": False,
            "message": "Request not found"
        }), 404

    # Validate Appointment Status
    if (
        req.status != "Pending"
        or req.appointment_status not in [
            "Pending",
            "Reschedule Requested"
        ]
    ):

        return jsonify({
            "success": False,
            "message": "Rescheduling is not allowed"
        }), 409

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({
            "success": False,
            "message": "Invalid request body"
        }), 400

    slots = data.get("slots")

    if (
        not isinstance(slots, list)
        or not slots
        or len(slots) > 10
    ):

        return jsonify({
            "success": False,
            "message": (
                "Provide between 1 and 10 alternative slots"
            )
        }), 400

    validated_slots = []

    seen = set()

    # Validate Suggested Slots
    try:

        for item in slots:

            if not isinstance(item, dict):

                raise ValueError(
                    "Invalid slot details"
                )

            date_value, start_time, end_time = validate_slot(

                item.get("appointment_date"),

                item.get("start_time"),

                item.get("end_time")
            )

            slot_key = (
                date_value,
                start_time,
                end_time
            )

            # Duplicate Slots Validation
            if slot_key in seen:

                raise ValueError(
                    "Duplicate time slots"
                )

            seen.add(slot_key)

            # Already Booked Slots Validation
            if not is_slot_available(

                date_value,

                start_time,

                end_time,

                req.id
            ):

                raise ValueError(
                    "One of the suggested slots is already booked"
                )

            validated_slots.append(
                (
                    date_value,
                    start_time,
                    end_time
                )
            )

    except (ValueError, TypeError) as error:

        return jsonify({
            "success": False,
            "message": str(error)
        }), 400

    try:

        # Expire Previous Suggested Slots
        for old_slot in req.appointment_slots:

            old_slot.status = "Expired"

        # Create New Alternative Slots
        for date_value, start_time, end_time in validated_slots:

            slot = AppointmentSlot(

                request_id=req.id,

                appointment_date=date_value,

                start_time=start_time,

                end_time=end_time,

                status="Available"
            )

            db.session.add(slot)

        req.appointment_status = (
            "Reschedule Requested"
        )

        db.session.commit()

        return jsonify({

            "success": True,

            "message": (
                "Alternative time slots suggested successfully"
            ),

            "data": serialize_request(req)

        }), 200

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to suggest time slots"
        }), 409


# ==========================================
# GENERATE INVOICE WITH DISCOUNT
# ==========================================

@admin_bp.route(
    "/requests/<int:request_id>/invoice",
    methods=["POST"]
)
@admin_required
def generate_invoice(request_id):

    req = ServiceRequest.query.filter_by(
        id=request_id
    ).with_for_update().first()

    if not req:

        return jsonify({
            "success": False,
            "message": "Request not found"
        }), 404

    # Prevent Duplicate Invoice
    if req.invoice:

        return jsonify({
            "success": False,
            "message": "Invoice already generated"
        }), 409

    if req.status != "Pending":

        return jsonify({
            "success": False,
            "message": "Request cannot be billed"
        }), 409

    # Appointment Confirmation Required
    # Old requests without appointment details are supported
    if (
        req.appointment_status is not None
        and req.appointment_status != "Confirmed"
    ):

        return jsonify({
            "success": False,
            "message": (
                "Confirm the appointment before generating invoice"
            )
        }), 409

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({
            "success": False,
            "message": "Invalid request body"
        }), 400

    services = data.get("services")

    if not isinstance(services, list) or not services:

        return jsonify({
            "success": False,
            "message": "Service amounts are required"
        }), 400

    amount_map = {}

    # Validate Service Amounts
    try:

        for service in services:

            if not isinstance(service, dict):

                raise ValueError()

            service_id = service["service_id"]

            if type(service_id) is not int:

                raise ValueError()

            if service_id in amount_map:

                raise ValueError()

            amount = Decimal(
                str(service["amount"])
            )

            if (
                not amount.is_finite()
                or amount < 0
                or amount > Decimal("9999999999.99")
            ):

                raise ValueError()

            if amount != amount.quantize(
                Decimal("0.01")
            ):

                raise ValueError()

            amount_map[service_id] = amount

    except (
        KeyError,
        ValueError,
        InvalidOperation,
        TypeError
    ):

        return jsonify({
            "success": False,
            "message": "Invalid service amounts"
        }), 400

    # Validate Selected Services
    selected_ids = {
        item.service_id
        for item in req.items
    }

    if selected_ids != set(amount_map.keys()):

        return jsonify({
            "success": False,
            "message": (
                "Enter amounts for all selected services only"
            )
        }), 400

    # Calculate Subtotal
    subtotal = sum(
        amount_map.values(),
        Decimal("0.00")
    )

    if subtotal > Decimal("9999999999.99"):

        return jsonify({
            "success": False,
            "message": "Subtotal exceeds allowed limit"
        }), 400

    # Validate Discount
    try:

        raw_discount = data.get(
            "discount_amount", "0"
        )

        if raw_discount is None or raw_discount == "":

            raw_discount = "0"

        discount_amount = Decimal(
            str(raw_discount)
        )

        if (
            not discount_amount.is_finite()
            or discount_amount < 0
            or discount_amount > subtotal
        ):

            raise ValueError()

        if discount_amount != discount_amount.quantize(
            Decimal("0.01")
        ):

            raise ValueError()

    except (
        ValueError,
        InvalidOperation,
        TypeError
    ):

        return jsonify({
            "success": False,
            "message": (
                "Discount must be between zero and subtotal"
            )
        }), 400

    # Calculate Final Amount
    total_amount = subtotal - discount_amount

    try:

        # Store Final Service Amounts
        for item in req.items:

            item.amount = amount_map[
                item.service_id
            ]

        # Create Invoice
        invoice = Invoice(

            invoice_number=f"KSCW-{req.id:06d}",

            request_id=req.id,

            subtotal=subtotal,

            discount_amount=discount_amount,

            total_amount=total_amount,
            tip_amount=Decimal("0.00"),

            payment_status=(
                "Paid"
                if total_amount == 0
                else "Unpaid"
            )
        )

        db.session.add(invoice)

        req.status = "Billed"

        db.session.commit()

        return jsonify({

            "success": True,

            "message": "Invoice generated successfully",

            "invoice_id": invoice.id,

            "invoice_number": invoice.invoice_number,

            "subtotal": str(invoice.subtotal),

            "discount_amount": str(
                invoice.discount_amount
            ),

            "total_amount": str(
                invoice.total_amount
            ),
            "service_amount": str(invoice.service_amount),
            "tip_amount": str(invoice.tip_amount),

            "payment_status": invoice.payment_status

        }), 201

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to generate invoice"
        }), 409


# ==========================================
# MANAGEMENT STAFF ACCOUNTS
# ==========================================

def serialize_staff(user):
    return {"id": user.id, "name": user.name, "mobile": user.mobile,
            "role": user.role, "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None}


@admin_bp.route("/management-staff", methods=["GET"])
@admin_required
def get_management_staff():
    staff = User.query.filter_by(role="management").order_by(User.id.desc()).all()
    return jsonify({"success": True, "data": [serialize_staff(user) for user in staff]}), 200


@admin_bp.route("/management-staff", methods=["POST"])
@admin_required
def create_management_staff():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"success": False, "message": "Invalid request body"}), 400
    name = str(data.get("name") or "").strip()
    mobile = str(data.get("mobile") or "").strip()
    password = data.get("password")
    if not name or len(name) > 100 or not re.fullmatch(r"[6-9][0-9]{9}", mobile):
        return jsonify({"success": False, "message": "Enter valid staff name and mobile"}), 400
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        return jsonify({"success": False, "message": "Password must contain 8 to 128 characters"}), 400
    if User.query.filter_by(mobile=mobile).first() or Customer.query.filter_by(mobile=mobile).first():
        return jsonify({"success": False, "message": "Mobile number already exists"}), 409
    try:
        staff = User(name=name, mobile=mobile, role="management", is_active=True)
        staff.set_password(password)
        db.session.add(staff)
        db.session.commit()
        return jsonify({"success": True, "message": "Management account created", "data": serialize_staff(staff)}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "message": "Mobile number already exists"}), 409


@admin_bp.route("/management-staff/<int:staff_id>", methods=["PUT"])
@admin_required
def update_management_staff(staff_id):
    staff = User.query.filter_by(id=staff_id, role="management").with_for_update().first()
    if not staff:
        return jsonify({"success": False, "message": "Management account not found"}), 404
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"success": False, "message": "Invalid request body"}), 400
    name = data.get("name", staff.name)
    mobile = data.get("mobile", staff.mobile)
    active = data.get("is_active", staff.is_active)
    password = data.get("password")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
        return jsonify({"success": False, "message": "Invalid staff name"}), 400
    if not isinstance(mobile, str) or not re.fullmatch(r"[6-9][0-9]{9}", mobile.strip()) or type(active) is not bool:
        return jsonify({"success": False, "message": "Invalid mobile or account status"}), 400
    if password is not None and (not isinstance(password, str) or not 8 <= len(password) <= 128):
        return jsonify({"success": False, "message": "Password must contain 8 to 128 characters"}), 400
    mobile = mobile.strip()
    if User.query.filter(User.mobile == mobile, User.id != staff.id).first() or Customer.query.filter_by(mobile=mobile).first():
        return jsonify({"success": False, "message": "Mobile number already exists"}), 409
    try:
        if active != staff.is_active or mobile != staff.mobile or password is not None:
            staff.staff_token_version += 1
        staff.name = name.strip()
        staff.mobile = mobile
        staff.is_active = active
        if password is not None:
            staff.set_password(password)
        db.session.commit()
        return jsonify({"success": True, "message": "Management account updated", "data": serialize_staff(staff)}), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "message": "Unable to update management account"}), 409


# ==========================================
# CUSTOMER SEARCH
# ==========================================

def customer_search_query(search):

    query = Customer.query.filter(
        Customer.is_active.is_(True)
    )

    if search:

        keyword = f"%{search}%"

        query = query.outerjoin(Vehicle).filter(

            or_(

                Customer.name.ilike(keyword),

                Customer.mobile.ilike(keyword),

                Customer.village.ilike(keyword),

                Vehicle.car_number.ilike(keyword),

                Vehicle.car_name.ilike(keyword)

            )

        ).distinct()

    return query


# ==========================================
# GET ALL CUSTOMERS
# ==========================================

@admin_bp.route("/customers", methods=["GET"])
@admin_required
def get_customers():

    search = request.args.get(
        "search", ""
    ).strip()

    customers = customer_search_query(search).order_by(
        Customer.id.desc()
    ).all()

    return jsonify({

        "success": True,

        "total": len(customers),

        "data": [
            {

                "customer_id": customer.id,

               "name": customer.name or "",
               "mobile": customer.mobile or "",
               "village": customer.village or "",

                "total_visits": len(customer.requests) + len(customer.manual_visits),

                "created_at": (
                    customer.created_at.isoformat()
                ),

                "vehicles": [
                    {

                        "vehicle_id": vehicle.id,

                        "car_name": vehicle.car_name or "",

                        "car_number": vehicle.car_number or ""
                    }
                    for vehicle in customer.vehicles
                ]
            }
            for customer in customers
        ]

    }), 200

# ==========================================
# ADD OLD CUSTOMER MANUALLY
# ==========================================

@admin_bp.route("/customers", methods=["POST"])
@admin_required
def add_customer():
    def fail(message, status=400):
        return jsonify({"success": False, "message": message}), status

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return fail("Invalid request body")

    name = str(data.get("name") or "").strip()
    mobile = str(data.get("mobile") or "").strip()
    village = str(data.get("village") or "").strip()
    if len(name) > 100 or len(village) > 150:
        return fail("Invalid customer details")
    if mobile and not re.fullmatch(r"[6-9][0-9]{9}", mobile):
        return fail("Enter valid mobile number")
    if mobile and (Customer.query.filter_by(mobile=mobile).first() or User.query.filter_by(mobile=mobile).first()):
        return fail("Mobile number already registered", 409)

    vehicles = data.get("vehicles", [])
    if not isinstance(vehicles, list) or len(vehicles) > 20:
        return fail("Invalid vehicle details")

    validated_vehicles = []
    car_numbers = set()
    for item in vehicles:
        if not isinstance(item, dict):
            return fail("Invalid vehicle details")
        make = str(item.get("car_make") or "").strip()
        number = re.sub(r"\s+", "", str(item.get("car_number") or "")).upper()
        if len(make) > 100 or len(number) > 20:
            return fail("Invalid vehicle details")
        if not make and not number:
            continue
        if number:
            if number in car_numbers:
                return fail("Duplicate car number", 409)
            if Vehicle.query.filter_by(car_number=number).first():
                return fail(f"Car number {number} already exists", 409)
            car_numbers.add(number)
        validated_vehicles.append({"car_make": make or None, "car_number": number or None})

    service_ids = data.get("service_ids", [])
    if not isinstance(service_ids, list) or any(type(s) is not int or s <= 0 for s in service_ids):
        return fail("Invalid service IDs")
    service_ids = list(dict.fromkeys(service_ids))
    services = Service.query.filter(Service.id.in_(service_ids)).all() if service_ids else []
    if len(services) != len(service_ids):
        return fail("Invalid services")
    snapshot = [{"service_id": s.id, "service_name": s.service_name} for s in services]

    date_value = data.get("service_date")
    service_date = None
    if date_value not in (None, ""):
        if not isinstance(date_value, str):
            return fail("Invalid service date")
        for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
            try:
                service_date = datetime.strptime(date_value.strip(), fmt).date()
                break
            except ValueError:
                pass
        if service_date is None:
            return fail("Enter a valid service date")

    raw_amount = data.get("amount")
    amount = None
    if raw_amount not in (None, ""):
        try:
            amount = Decimal(str(raw_amount))
            if not amount.is_finite() or amount < 0 or amount > Decimal("9999999999.99") or amount != amount.quantize(Decimal("0.01")):
                raise ValueError()
        except (ValueError, InvalidOperation, TypeError):
            return fail("Enter a valid amount with up to two decimal places")

    try:
        customer = Customer(user_id=None, name=name or None, mobile=mobile or None,
                            village=village or None, is_active=True)
        db.session.add(customer)
        db.session.flush()
        for item in validated_vehicles:
            db.session.add(Vehicle(customer_id=customer.id, car_name=item["car_make"], car_number=item["car_number"]))

        # A contact-only record is not a service visit.
        # Date defaults to today in IST only when an actual historical entry is saved.
        visit = None
        if service_date is not None or snapshot or amount is not None:
            visit = ManualVisit(customer_id=customer.id, created_by_user_id=int(get_jwt_identity()),
                                service_date=service_date or datetime.now(timezone(timedelta(hours=5, minutes=30))).date(),
                                amount=amount, services=snapshot, vehicles_snapshot=validated_vehicles)
            db.session.add(visit)
            db.session.flush()
        result = {"success": True, "message": "Customer added successfully",
                  "customer_id": customer.id, "manual_visit_id": visit.id if visit else None}
        db.session.commit()
        return jsonify(result), 201
    except IntegrityError:
        db.session.rollback()
        return fail("Customer or vehicle already exists", 409)


# ==========================================
# DELETE OR ARCHIVE CUSTOMER
# ==========================================

@admin_bp.route(
    "/customers/<int:customer_id>",
    methods=["DELETE"]
)
@admin_required
def delete_customer(customer_id):

    customer = Customer.query.filter_by(
        id=customer_id
    ).with_for_update().first()

    if not customer:

        return jsonify({
            "success": False,
            "message": "Customer not found"
        }), 404

    try:

        has_history = ServiceRequest.query.filter_by(
            customer_id=customer.id
        ).first() is not None or ManualVisit.query.filter_by(customer_id=customer.id).first() is not None

        # Preserve service history and registered accounts.

        if has_history or customer.user_id is not None:

            customer.is_active = False

            db.session.commit()

            return jsonify({

                "success": True,

                "message": (
                    "Customer archived. Existing records preserved."
                ),

                "action": "archived"

            }), 200

        # Permanently delete manual customers
        # without any service history or login account.

        for vehicle in list(customer.vehicles):

            db.session.delete(vehicle)

        db.session.flush()

        db.session.delete(customer)

        db.session.commit()

        return jsonify({

            "success": True,

            "message": "Customer deleted successfully",

            "action": "deleted"

        }), 200

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Customer has linked records and cannot be deleted"
        }), 409


# ==========================================
# CUSTOMER SERVICE HISTORY
# ==========================================

@admin_bp.route(
    "/customers/<int:customer_id>/history",
    methods=["GET"]
)
@admin_required
def customer_history(customer_id):

    customer = db.session.get(
        Customer, customer_id
    )

    if not customer:

        return jsonify({
            "success": False,
            "message": "Customer not found"
        }), 404

    records = ServiceRequest.query.filter_by(
        customer_id=customer.id
    ).order_by(
        ServiceRequest.id.desc()
    ).all()

    manual_records = ManualVisit.query.filter_by(customer_id=customer.id).all()
    history = [serialize_request(record) for record in records]
    history.extend(record.serialize() for record in manual_records)
    history.sort(key=lambda item: item.get("service_date") or item.get("created_at") or "", reverse=True)

    return jsonify({

        "success": True,

        "customer": {

            "customer_id": customer.id,

          "name": customer.name or "",
          "mobile": customer.mobile or "",
          "village": customer.village or "",
        },

        "total_visits": len(history),

        "data": history

    }), 200


# ==========================================
# EXCEL EXPORT
# ==========================================

def safe_text(value):

    value = str(value or "")

    if value.startswith(
        ("=", "+", "-", "@", "\t", "\r")
    ):

        return "'" + value

    return value


@admin_bp.route(
    "/customers/export",
    methods=["GET"]
)
@admin_required
def export_customers():

    search = request.args.get(
        "search", ""
    ).strip()

    customers = customer_search_query(search).order_by(
        Customer.id.asc()
    ).all()

    workbook = Workbook()

    sheet = workbook.active

    sheet.title = "Customers"

    sheet.append([
        "Customer ID",
        "Customer Name",
        "Mobile Number",
        "Village",
        "Car Name",
        "Car Number",
        "Total Visits",
        "Registered Date"
    ])

    # Header Styling
    for cell in sheet[1]:

        cell.font = Font(
            bold=True,
            color="FFFFFF"
        )

        cell.fill = PatternFill(
            fill_type="solid",
            fgColor="0EA5E9"
        )

        cell.alignment = Alignment(
            horizontal="center",
            vertical="center"
        )

    sheet.row_dimensions[1].height = 25

    # Customer Data
    for customer in customers:

        vehicles = customer.vehicles or [None]

        for vehicle in vehicles:

            sheet.append([

                customer.id,

                safe_text(customer.name),

                safe_text(customer.mobile),

                safe_text(customer.village),

                safe_text(vehicle.car_name)
                if vehicle else "",

                safe_text(vehicle.car_number)
                if vehicle else "",

                len(customer.requests) + len(customer.manual_visits),

                customer.created_at.strftime(
                    "%d-%m-%Y"
                )
            ])

    # Automatic Column Width
    for column in sheet.columns:

        width = max(
            len(str(cell.value or ""))
            for cell in column
        )

        sheet.column_dimensions[
            column[0].column_letter
        ].width = min(width + 5, 60)

    sheet.freeze_panes = "A2"

    sheet.auto_filter.ref = sheet.dimensions

    # Separate visit rows prevent amounts being repeated for multiple vehicles.
    visits_sheet = workbook.create_sheet("Manual Service History")
    visits_sheet.append(["Customer ID", "Customer Name", "Mobile", "Service Date", "Services", "Vehicles", "Received Amount"])
    for customer in customers:
        for visit in sorted(customer.manual_visits, key=lambda row: (row.service_date, row.id)):
            visits_sheet.append([
                customer.id, safe_text(customer.name), safe_text(customer.mobile),
                visit.service_date.strftime("%d/%m/%Y"),
                safe_text(", ".join(s["service_name"] for s in visit.services)),
                safe_text(", ".join(v.get("car_number") or v.get("car_make") or "" for v in visit.vehicles_snapshot)),
                float(visit.amount) if visit.amount is not None else None,
            ])
    for cell in visits_sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(fill_type="solid", fgColor="0EA5E9")
    for column in visits_sheet.columns:
        visits_sheet.column_dimensions[column[0].column_letter].width = min(max(len(str(c.value or "")) for c in column) + 5, 60)
    visits_sheet.freeze_panes = "A2"
    visits_sheet.auto_filter.ref = visits_sheet.dimensions

    buffer = BytesIO()

    workbook.save(buffer)

    buffer.seek(0)

    return send_file(

        buffer,

        as_attachment=True,

        download_name="Karthikeya_Customers.xlsx",

        mimetype=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        )
    )


# ==========================================
# ADMIN SETTINGS
# ==========================================

# Get Admin Profile
@admin_bp.route("/profile", methods=["GET"])
@admin_required
def get_admin_profile():

    admin = db.session.get(
        User, int(get_jwt_identity())
    )

    return jsonify({

        "success": True,

        "data": {

            "id": admin.id,

            "name": admin.name,

            "mobile": admin.mobile,

            "role": admin.role
        }

    }), 200


# ==========================================
# UPDATE ADMIN PROFILE
# ==========================================

@admin_bp.route("/profile", methods=["PUT"])
@admin_required
def update_admin_profile():

    admin = User.query.filter_by(

        id=int(get_jwt_identity()),

        role="admin"

    ).with_for_update().populate_existing().first()

    if not admin:

        return jsonify({
            "success": False,
            "message": "Admin account not found"
        }), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):

        return jsonify({
            "success": False,
            "message": "Invalid request body"
        }), 400

    name = data.get("name", "")

    mobile = data.get("mobile", "")

    current_password = data.get(
        "current_password", ""
    )

    new_password = data.get(
        "new_password", ""
    )

    if not all(

        isinstance(value, str)

        for value in [

            name,

            mobile,

            current_password,

            new_password
        ]
    ):

        return jsonify({
            "success": False,
            "message": "Invalid input"
        }), 400

    name = name.strip()

    mobile = mobile.strip()

    # Validate Admin Name
    if not name or len(name) > 100:

        return jsonify({
            "success": False,
            "message": "Enter a valid admin name"
        }), 400

    # Validate Mobile Number
    if not re.fullmatch(
        r"[6-9][0-9]{9}", mobile
    ):

        return jsonify({
            "success": False,
            "message": "Invalid mobile number"
        }), 400

    # Verify Current Password
    if not admin.check_password(current_password):

        return jsonify({
            "success": False,
            "message": "Current password is incorrect"
        }), 400

    # Validate New Password
    if new_password and len(new_password) < 8:

        return jsonify({
            "success": False,
            "message": (
                "New password must contain at least 8 characters"
            )
        }), 400

    # Check Duplicate Mobile Number
    existing_user = User.query.filter(

        User.mobile == mobile,

        User.id != admin.id

    ).first()

    if existing_user:

        return jsonify({
            "success": False,
            "message": "Mobile number already registered"
        }), 409

    try:

        admin.name = name

        admin.mobile = mobile

        if new_password:

            admin.set_password(
                new_password
            )

        db.session.commit()

        return jsonify({

            "success": True,

            "message": (
                "Admin credentials updated successfully"
            )

        }), 200

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update admin credentials"
        }), 409
