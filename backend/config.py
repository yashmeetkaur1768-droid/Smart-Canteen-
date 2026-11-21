import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATH = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "database", "canteen.db"))
CPP_DIR = os.path.join(BASE_DIR, "cpp")

# Choose engine executable by OS: cpp/engine.exe on Windows, cpp/engine on Linux/Unix
ENGINE_BINARY = "engine.exe" if os.name == "nt" else "engine"
CPP_ENGINE_EXECUTABLE = os.path.join(CPP_DIR, ENGINE_BINARY)

SCHEMA_PATH = os.path.join(BASE_DIR, "database", "schema.sql")

PARALLEL_STATIONS = 2
PORT = int(os.environ.get("PORT", 5000))

# Detect production environment (e.g. Render, or explicit environment setting)
IS_PRODUCTION = (
    os.environ.get("RENDER") is not None
    or os.environ.get("ENV", "").lower() == "production"
    or os.environ.get("FLASK_ENV", "").lower() == "production"
)

# DEBUG must default to False in production, True in local development
if IS_PRODUCTION:
    DEBUG = os.environ.get("DEBUG", "false").lower() in ("true", "1", "t", "yes")
else:
    DEBUG = os.environ.get("DEBUG", "true").lower() in ("true", "1", "t", "yes")

# Allowed origins for CORS (comma-separated). Unset / empty indicates local development default.
raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
ALLOWED_ORIGINS = [orig.strip() for orig in raw_origins.split(",") if orig.strip()] if raw_origins else []

# Secret key handling
SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("CANTEEN_SECRET_KEY")

# Fail loudly if SECRET_KEY is missing in production
if IS_PRODUCTION or (not DEBUG and not any("unittest" in arg or "test" in arg for arg in sys.argv)):
    if not SECRET_KEY or SECRET_KEY == "dev-secret-key-change-in-production":
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: The 'SECRET_KEY' environment variable must be set in production! "
            "Please configure SECRET_KEY in your hosting environment (e.g. Render Dashboard or render.yaml)."
        )
else:
    if not SECRET_KEY:
        SECRET_KEY = "dev-secret-key-change-in-production"
