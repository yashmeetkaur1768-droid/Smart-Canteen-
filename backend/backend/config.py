import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATH = os.path.join(BASE_DIR, "database", "canteen.db")
CPP_DIR = os.path.join(BASE_DIR, "cpp")
CPP_ENGINE_EXECUTABLE = os.path.join(CPP_DIR, "engine.exe")
SCHEMA_PATH = os.path.join(BASE_DIR, "database", "schema.sql")

PARALLEL_STATIONS = 2
PORT = 5000
DEBUG = True

SECRET_KEY = os.environ.get('CANTEEN_SECRET_KEY', 'dev-secret-key-change-in-production')
