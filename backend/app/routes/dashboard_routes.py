from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.extensions import db
from app.models.customer import Customer
from app.models.service_request import ServiceRequest
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.request_item import RequestItem
from app.models.service import Service
from app.routes.admin_routes import admin_required


dashboard_bp = Blueprint("dashboard", __name__)

IST = timezone(timedelta(hours=5, minutes=30))


# Customer Count
def customer_count(start_date, end_date):

    return db.session.query(
        func.count(func.distinct(ServiceRequest.customer_id))
    ).filter(
        ServiceRequest.created_at >= start_date,
        ServiceRequest.created_at < end_date
    ).scalar() or 0


# Revenue Count
def revenue_count(start_date, end_date):

    return db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(
        Payment.paid_at >= start_date,
        Payment.paid_at < end_date
    ).scalar()


# Date Ranges
def get_date_range(period):

    today = datetime.now(IST).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0
    )

    if period == "daily":
        return today, today + timedelta(days=1)

    if period == "weekly":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=7)

    if period == "monthly":
        start = today.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)
        return start, end

    return None, None


# Dashboard Summary
@dashboard_bp.route("/summary", methods=["GET"])
@admin_required
def dashboard_summary():

    total_customers = Customer.query.count()

    total_requests = ServiceRequest.query.count()

    pending_requests = ServiceRequest.query.filter_by(
        status="Pending"
    ).count()

    billed_requests = ServiceRequest.query.filter_by(
        status="Billed"
    ).count()

    paid_invoices = Invoice.query.filter_by(
        payment_status="Paid"
    ).count()

    unpaid_invoices = Invoice.query.filter_by(
        payment_status="Unpaid"
    ).count()

    total_revenue = db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).scalar()

    periods = {}

    for period in ["daily", "weekly", "monthly"]:

        start, end = get_date_range(period)

        periods[period] = {
            "customers": customer_count(start, end),
            "revenue": str(revenue_count(start, end))
        }

    return jsonify({
        "success": True,
        "data": {
            "total_customers": total_customers,
            "total_requests": total_requests,
            "pending_requests": pending_requests,
            "billed_requests": billed_requests,
            "paid_invoices": paid_invoices,
            "unpaid_invoices": unpaid_invoices,
            "total_revenue": str(total_revenue),
            "daily": periods["daily"],
            "weekly": periods["weekly"],
            "monthly": periods["monthly"]
        }
    }), 200


# Dashboard Pie Charts
@dashboard_bp.route("/charts", methods=["GET"])
@admin_required
def dashboard_charts():

    period = request.args.get("period", "daily")

    start, end = get_date_range(period)

    if start is None:
        return jsonify({
            "success": False,
            "message": "Invalid period"
        }), 400

    # Service Distribution
    service_data = db.session.query(
        Service.service_name,
        func.count(RequestItem.id)
    ).join(
        RequestItem,
        RequestItem.service_id == Service.id
    ).join(
        ServiceRequest,
        ServiceRequest.id == RequestItem.request_id
    ).filter(
        ServiceRequest.created_at >= start,
        ServiceRequest.created_at < end
    ).group_by(
        Service.id,
        Service.service_name
    ).all()

    # Request Status Distribution
    status_data = db.session.query(
        ServiceRequest.status,
        func.count(ServiceRequest.id)
    ).filter(
        ServiceRequest.created_at >= start,
        ServiceRequest.created_at < end
    ).group_by(
        ServiceRequest.status
    ).all()

    # Invoice Payment Status Distribution
    payment_data = db.session.query(
        Invoice.payment_status,
        func.count(Invoice.id)
    ).filter(
        Invoice.created_at >= start,
        Invoice.created_at < end
    ).group_by(
        Invoice.payment_status
    ).all()

    # Payment Method Revenue Distribution
    revenue_data = db.session.query(
        Payment.payment_method,
        func.sum(Payment.amount)
    ).filter(
        Payment.paid_at >= start,
        Payment.paid_at < end
    ).group_by(
        Payment.payment_method
    ).all()

    return jsonify({
        "success": True,
        "period": period,

        "total_customers": customer_count(start, end),

        "services": [
            {
                "name": name,
                "value": count
            }
            for name, count in service_data
        ],

        "request_status": [
            {
                "name": status,
                "value": count
            }
            for status, count in status_data
        ],

        "payment_status": [
            {
                "name": status,
                "value": count
            }
            for status, count in payment_data
        ],

        "payment_methods": [
            {
                "name": method,
                "value": float(amount)
            }
            for method, amount in revenue_data
        ]
    }), 200