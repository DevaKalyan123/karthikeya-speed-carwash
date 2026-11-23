from flask import Flask, jsonify
from app import models
from flask_cors import CORS
from sqlalchemy import text
from app.routes.service_routes import service_bp
from app.routes.auth_routes import auth_bp
from app.routes.request_routes import request_bp
from app.routes.admin_routes import admin_bp
from app.routes.invoice_routes import invoice_bp
from app.routes.payment_routes import payment_bp
from app.routes.dashboard_routes import dashboard_bp

from app.config import Config
from app.extensions import db, migrate, jwt


def create_app():
    app = Flask(__name__)

    app.config.from_object(Config)

    CORS(app, origins=["http://localhost:3000",
     "https://tc2t1qzp-3000.inc1.devtunnels.ms"
    ])
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    app.register_blueprint(
    service_bp,
    url_prefix="/api/services"
)

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({
            "success": True,
            "message": "Karthikeya Speed Car Wash API is running"
        })

    app.register_blueprint(
    admin_bp,
    url_prefix="/api/admin"
)

    app.register_blueprint(
    invoice_bp,
    url_prefix="/api/invoices"
)

    app.register_blueprint(
    payment_bp,
    url_prefix="/api/payments"
)

    app.register_blueprint(
    dashboard_bp,
    url_prefix="/api/dashboard"
)

    app.register_blueprint(
    auth_bp,
    url_prefix="/api/auth"
)
    app.register_blueprint(
    request_bp,
    url_prefix="/api/requests"
)

    @app.route("/api/db-test", methods=["GET"])
    def db_test():
        try:
            db.session.execute(text("SELECT 1"))

            return jsonify({
                "success": True,
                "message": "PostgreSQL connected successfully"
            })

        except Exception:
            app.logger.exception("Database connection failed")

            return jsonify({
                "success": False,
                "message": "Database connection failed"
            }), 500
        

    return app