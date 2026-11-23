import re

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


admin_bp = Blueprint("admin", __name__)


# Admin Authorization
def admin_required(fn):

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):

        user = db.session.get(
            User, int(get_jwt_identity())
        )

        if not user or user.role != "admin":
            return jsonify({
                "success": False,
                "message": "Admin access only"
            }), 403

        return fn(*args, **kwargs)

    return wrapper


# Request Details
def serialize_request(req):

    return {
        "request_id": req.id,
        "customer_id": req.customer_id,
        "customer_name": req.customer.name,
        "mobile": req.customer.mobile,
        "village": req.customer.village,
        "car_name": req.vehicle.car_name,
        "car_number": req.vehicle.car_number,
        "status": req.status,
        "created_at": req.created_at.isoformat(),

        "services": [
            {
                "item_id": item.id,
                "service_id": item.service_id,
                "service_name": item.service.service_name,
                "amount": str(item.amount)
                if item.amount is not None else None
            }
            for item in req.items
        ],

        "invoice_id": req.invoice.id if req.invoice else None,

        "invoice_number": (
            req.invoice.invoice_number
            if req.invoice else None
        ),

        "total_amount": (
            str(req.invoice.total_amount)
            if req.invoice else None
        ),

        "payment_status": (
            req.invoice.payment_status
            if req.invoice else None
        )
    }


# Get All Customer Requests
@admin_bp.route("/requests", methods=["GET"])
@admin_required
def get_all_requests():

    status = request.args.get("status")

    query = ServiceRequest.query

    if status:
        query = query.filter_by(status=status)

    requests = query.order_by(
        ServiceRequest.id.desc()
    ).all()

    return jsonify({
        "success": True,
        "total": len(requests),
        "data": [
            serialize_request(req)
            for req in requests
        ]
    }), 200


# Get Particular Request
@admin_bp.route("/requests/<int:request_id>", methods=["GET"])
@admin_required
def get_request(request_id):

    req = db.session.get(ServiceRequest, request_id)

    if not req:
        return jsonify({
            "success": False,
            "message": "Request not found"
        }), 404

    return jsonify({
        "success": True,
        "data": serialize_request(req)
    }), 200


# Generate Invoice
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

    if req.invoice:
        return jsonify({
            "success": False,
            "message": "Invoice already generated"
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

    try:

        for service in services:

            if not isinstance(service, dict):
                raise ValueError()

            service_id = service["service_id"]

            if type(service_id) is not int:
                raise ValueError()

            if service_id in amount_map:
                raise ValueError()

            amount = Decimal(str(service["amount"]))

            if (
                not amount.is_finite()
                or amount < 0
                or amount > Decimal("9999999999.99")
            ):
                raise ValueError()

            if amount != amount.quantize(Decimal("0.01")):
                raise ValueError()

            amount_map[service_id] = amount

    except (KeyError, ValueError, InvalidOperation, TypeError):

        return jsonify({
            "success": False,
            "message": "Invalid service amounts"
        }), 400

    selected_ids = {
        item.service_id for item in req.items
    }

    if selected_ids != set(amount_map.keys()):
        return jsonify({
            "success": False,
            "message": "Enter amounts for all selected services only"
        }), 400

    total_amount = sum(
        amount_map.values(), Decimal("0.00")
    )

    if total_amount > Decimal("9999999999.99"):
        return jsonify({
            "success": False,
            "message": "Total amount exceeds allowed limit"
        }), 400

    try:

        for item in req.items:
            item.amount = amount_map[item.service_id]

        invoice = Invoice(
            invoice_number=f"KSCW-{req.id:06d}",
            request_id=req.id,
            total_amount=total_amount,
            payment_status="Unpaid"
        )

        db.session.add(invoice)

        req.status = "Billed"

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Invoice generated successfully",
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "total_amount": str(invoice.total_amount),
            "payment_status": invoice.payment_status
        }), 201

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to generate invoice"
        }), 409


# Customer Search Query
def customer_search_query(search):

    query = Customer.query

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


# Get All Customers and Search
@admin_bp.route("/customers", methods=["GET"])
@admin_required
def get_customers():

    search = request.args.get("search", "").strip()

    customers = customer_search_query(search).order_by(
        Customer.id.desc()
    ).all()

    return jsonify({
        "success": True,
        "total": len(customers),
        "data": [
            {
                "customer_id": customer.id,
                "name": customer.name,
                "mobile": customer.mobile,
                "village": customer.village,
                "total_visits": len(customer.requests),

                "created_at": customer.created_at.isoformat(),

                "vehicles": [
                    {
                        "vehicle_id": vehicle.id,
                        "car_name": vehicle.car_name,
                        "car_number": vehicle.car_number
                    }
                    for vehicle in customer.vehicles
                ]
            }
            for customer in customers
        ]
    }), 200


# Customer Previous Service History
@admin_bp.route("/customers/<int:customer_id>/history", methods=["GET"])
@admin_required
def customer_history(customer_id):

    customer = db.session.get(Customer, customer_id)

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

    return jsonify({
        "success": True,

        "customer": {
            "customer_id": customer.id,
            "name": customer.name,
            "mobile": customer.mobile,
            "village": customer.village
        },

        "total_visits": len(records),

        "data": [
            serialize_request(record)
            for record in records
        ]
    }), 200


# Protect Excel Text Cells
def safe_text(value):

    value = str(value or "")

    if value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + value

    return value


# Export Customers Excel Report
@admin_bp.route("/customers/export", methods=["GET"])
@admin_required
def export_customers():

    search = request.args.get("search", "").strip()

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

                len(customer.requests),

                customer.created_at.strftime("%d-%m-%Y")
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

    # Download Excel
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


# Update Admin Profile
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
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

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
    if not re.fullmatch(r"[6-9][0-9]{9}", mobile):
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
            "message": "New password must contain at least 8 characters"
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
            admin.set_password(new_password)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Admin credentials updated successfully"
        }), 200

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update admin credentials"
        }), 409