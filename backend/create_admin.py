from getpass import getpass

from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()

with app.app_context():

    name = input("Admin name: ").strip()
    mobile = input("Admin mobile: ").strip()

    existing_admin = User.query.filter_by(mobile=mobile).first()

    if existing_admin:
        print("Mobile number already registered")

    else:
        password = getpass("Admin password: ")

        if len(password) < 8:
            print("Password must contain at least 8 characters")

        else:
            admin = User(
                name=name,
                mobile=mobile,
                role="admin"
            )

            admin.set_password(password)

            db.session.add(admin)
            db.session.commit()

            print("Admin created successfully")