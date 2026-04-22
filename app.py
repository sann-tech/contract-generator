"""
DevZan Contract Generator — Multi-User Flask Backend
Google OAuth + SQLite/PostgreSQL + Guest mode support
"""

import os, json, base64, smtplib, uuid
from datetime import datetime

from flask import (Flask, request, jsonify, render_template,
                   session, redirect, url_for)
from flask_sqlalchemy import SQLAlchemy
from flask_login import (LoginManager, UserMixin, login_user,
                         logout_user, current_user)
from flask_dance.contrib.google import make_google_blueprint, google
from flask_dance.consumer import oauth_authorized
from sqlalchemy.orm.exc import NoResultFound

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

# ── App config ────────────────────────────────────────────────────
app = Flask(__name__, template_folder="templates")

# Secret key — DAPAT may SECRET_KEY sa environment variables
app.secret_key = os.environ.get("SECRET_KEY")
if not app.secret_key:
    raise RuntimeError("SECRET_KEY environment variable is not set!")

IS_PRODUCTION = os.environ.get("FLASK_ENV") == "production"

app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"]   = IS_PRODUCTION  # True sa production (HTTPS)
app.config["PERMANENT_SESSION_LIFETIME"] = 3600

# Pinapayagan ang HTTP para sa OAuth sa local development ONLY
if not IS_PRODUCTION:
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

# ── Database ──────────────────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///devzan.db")

# Fix para sa Render/Railway — ginagamit nila "postgres://" pero SQLAlchemy
# ay nangangailangan ng "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# ── Login Manager ─────────────────────────────────────────────────
login_manager = LoginManager(app)
login_manager.login_view = "/"

# ── Google OAuth Blueprint ────────────────────────────────────────
google_bp = make_google_blueprint(
    client_id=os.environ.get("GOOGLE_CLIENT_ID", ""),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET", ""),
    scope=["openid",
           "https://www.googleapis.com/auth/userinfo.email",
           "https://www.googleapis.com/auth/userinfo.profile"],
    redirect_to="dashboard",
    offline=True,
)
app.register_blueprint(google_bp, url_prefix="/auth")

# ── Models ────────────────────────────────────────────────────────
class User(UserMixin, db.Model):
    __tablename__ = "users"
    id         = db.Column(db.String(64), primary_key=True,
                           default=lambda: "u_" + uuid.uuid4().hex[:10])
    google_id  = db.Column(db.String(128), unique=True, nullable=False)
    email      = db.Column(db.String(256), nullable=False)
    name       = db.Column(db.String(256))
    avatar     = db.Column(db.String(512))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    contracts  = db.relationship("Contract", backref="owner",
                                 lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "email": self.email,
                "name": self.name, "avatar": self.avatar}


class Contract(db.Model):
    __tablename__ = "contracts"
    id         = db.Column(db.String(32), primary_key=True,
                           default=lambda: "c_" + uuid.uuid4().hex[:8])
    num        = db.Column(db.String(64))
    user_id    = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=True)
    data       = db.Column(db.Text, default="{}")
    revisions  = db.Column(db.Text, default="[]")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    def to_dict(self):
        d = json.loads(self.data or "{}")
        d["id"]        = self.id
        d["num"]       = self.num
        d["revisions"] = json.loads(self.revisions or "[]")
        d["createdAt"] = self.created_at.strftime("%b %d, %Y %I:%M %p") if self.created_at else ""
        d["updatedAt"] = self.updated_at.strftime("%b %d, %Y %I:%M %p") if self.updated_at else ""
        return d


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, user_id)

def now_str():
    return datetime.now().strftime("%b %d, %Y %I:%M %p")

# ── OAuth callback ────────────────────────────────────────────────
@oauth_authorized.connect_via(google_bp)
def google_logged_in(blueprint, token):
    if not token:
        return False
    resp = blueprint.session.get("/oauth2/v2/userinfo")
    if not resp.ok:
        return False
    info      = resp.json()
    google_id = info["id"]
    try:
        user = User.query.filter_by(google_id=google_id).one()
        user.name   = info.get("name",    user.name)
        user.avatar = info.get("picture", user.avatar)
        user.email  = info.get("email",   user.email)
        db.session.commit()
    except NoResultFound:
        user = User(
            google_id=google_id,
            email=info.get("email", ""),
            name=info.get("name", ""),
            avatar=info.get("picture", ""),
        )
        db.session.add(user)
        db.session.commit()
    login_user(user, remember=False)
    return False

@app.route("/auth/logout")
def logout():
    logout_user()
    session.pop("google_oauth_token", None)
    session.clear()
    response = redirect(url_for("index"))
    response.delete_cookie("remember_token")
    response.delete_cookie("session")
    return response

@app.route("/api/me")
def me():
    if current_user.is_authenticated:
        return jsonify({"loggedIn": True, "user": current_user.to_dict()})
    return jsonify({"loggedIn": False})

@app.route("/")
def index():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    return render_template("login.html")

@app.route("/app")
def dashboard():
    if not current_user.is_authenticated:
        return redirect(url_for("index"))
    return render_template("index.html", user=current_user.to_dict())

@app.route("/guest")
def guest():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    return render_template("index.html", user=None)

# ── Contracts ─────────────────────────────────────────────────────
@app.route("/api/contracts", methods=["GET"])
def get_contracts():
    if not current_user.is_authenticated:
        return jsonify([])
    rows = Contract.query.filter_by(user_id=current_user.id)\
                         .order_by(Contract.created_at).all()
    return jsonify([c.to_dict() for c in rows])

@app.route("/api/contracts", methods=["POST"])
def upsert_contract():
    if not current_user.is_authenticated:
        return jsonify({"error": "Login required"}), 401
    data = request.json or {}
    cid  = data.get("id")
    if cid:
        c = db.session.get(Contract, cid)
        if not c or c.user_id != current_user.id:
            return jsonify({"error": "Not found"}), 404
        revs = json.loads(c.revisions or "[]")
        revs.insert(0, {"note": "Contract updated", "time": now_str(), "type": "info"})
        c.revisions  = json.dumps(revs)
        c.data       = json.dumps({k: v for k, v in data.items()
                                   if k not in ("id","num","revisions","createdAt","updatedAt")})
        c.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(c.to_dict())
    else:
        seq = Contract.query.filter_by(user_id=current_user.id).count() + 1
        num = f"CONTRACT-{datetime.now().year}-{str(seq).zfill(3)}"
        payload = {k: v for k, v in data.items()
                   if k not in ("id","num","revisions","createdAt","updatedAt")}
        c = Contract(
            user_id=current_user.id, num=num,
            data=json.dumps(payload),
            revisions=json.dumps([{"note": "Contract created", "time": now_str(), "type": "info"}]),
        )
        db.session.add(c)
        db.session.commit()
        return jsonify(c.to_dict()), 201

@app.route("/api/contracts/<cid>", methods=["DELETE"])
def delete_contract(cid):
    if not current_user.is_authenticated:
        return jsonify({"error": "Login required"}), 401
    c = db.session.get(Contract, cid)
    if not c or c.user_id != current_user.id:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/api/contracts/<cid>/revisions", methods=["POST"])
def add_revision(cid):
    if not current_user.is_authenticated:
        return jsonify({"error": "Login required"}), 401
    c = db.session.get(Contract, cid)
    if not c or c.user_id != current_user.id:
        return jsonify({"error": "Not found"}), 404
    note = (request.json or {}).get("note", "Manual note")
    revs = json.loads(c.revisions or "[]")
    revs.insert(0, {"note": note, "time": now_str(), "type": "info"})
    c.revisions = json.dumps(revs)
    db.session.commit()
    return jsonify({"ok": True, "time": now_str()})

@app.route("/api/contracts/import", methods=["POST"])
def import_guest_contracts():
    if not current_user.is_authenticated:
        return jsonify({"error": "Login required"}), 401
    imported = 0
    for data in (request.json or []):
        seq = Contract.query.filter_by(user_id=current_user.id).count() + 1
        num = data.get("num") or f"CONTRACT-{datetime.now().year}-{str(seq).zfill(3)}"
        payload = {k: v for k, v in data.items()
                   if k not in ("id","num","revisions","createdAt","updatedAt")}
        db.session.add(Contract(
            user_id=current_user.id, num=num,
            data=json.dumps(payload),
            revisions=json.dumps(data.get("revisions", [])),
        ))
        imported += 1
    db.session.commit()
    return jsonify({"ok": True, "imported": imported})

# ── PDF Generation ────────────────────────────────────────────────
@app.route("/api/generate-pdf", methods=["POST"])
def generate_pdf():
    html_content = (request.json or {}).get("html", "")
    filename     = (request.json or {}).get("filename", "contract.pdf")
    if not html_content:
        return jsonify({"ok": False, "error": "No HTML provided"}), 400
    try:
        from xhtml2pdf import pisa
        import io
        print(f"  [PDF] Generating {filename} ({len(html_content)} chars of HTML)…")
        pdf_buffer = io.BytesIO()
        result = pisa.CreatePDF(html_content, dest=pdf_buffer)
        if result.err:
            raise Exception(f"xhtml2pdf error code: {result.err}")
        pdf_bytes  = pdf_buffer.getvalue()
        print(f"  [PDF] Done — {len(pdf_bytes)} bytes")
        pdf_base64 = base64.b64encode(pdf_bytes).decode()
        return jsonify({"ok": True, "pdf_base64": pdf_base64, "filename": filename})
    except ImportError:
        return jsonify({"ok": False, "error": "xhtml2pdf not installed. Run: pip install xhtml2pdf"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ── Email ─────────────────────────────────────────────────────────
@app.route("/api/send-email", methods=["POST"])
def send_email():
    d        = request.json or {}
    smtp_cfg = d.get("smtp", {})
    if not smtp_cfg.get("user") or not smtp_cfg.get("password"):
        return jsonify({"ok": False, "error": "SMTP credentials required."}), 400
    if not d.get("to"):
        return jsonify({"ok": False, "error": "Recipient email required."}), 400
    try:
        msg            = MIMEMultipart("mixed")
        msg["From"]    = smtp_cfg["user"]
        msg["To"]      = d["to"]
        msg["Subject"] = d.get("subject", "Web Development Contract")
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(d.get("body", ""), "plain"))
        alt.attach(MIMEText(d.get("body_html") or d.get("body","").replace("\n","<br>"), "html"))
        msg.attach(alt)
        if d.get("pdf_base64"):
            part = MIMEBase("application", "pdf")
            part.set_payload(base64.b64decode(d["pdf_base64"]))
            encoders.encode_base64(part)
            part.add_header("Content-Disposition",
                            f'attachment; filename="{d.get("pdf_filename","contract.pdf")}"')
            msg.attach(part)
        with smtplib.SMTP(smtp_cfg.get("host","smtp.gmail.com"),
                          int(smtp_cfg.get("port", 587)), timeout=15) as s:
            s.ehlo(); s.starttls()
            s.login(smtp_cfg["user"], smtp_cfg["password"])
            s.sendmail(smtp_cfg["user"], d["to"], msg.as_string())
        return jsonify({"ok": True, "message": f"Email sent to {d['to']}"})
    except smtplib.SMTPAuthenticationError:
        return jsonify({"ok": False, "error": "SMTP auth failed. Use Gmail App Password."}), 401
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ── Init DB ───────────────────────────────────────────────────────
with app.app_context():
    db.create_all()

@app.route('/terms')
def terms():
    return render_template('tos.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

if __name__ == "__main__":
    print("\n  ⚡ DevZan Contract Generator (Multi-User)")
    print("  Running at: http://127.0.0.1:5000\n")
    app.run(debug=not IS_PRODUCTION, port=5000)