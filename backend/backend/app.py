import os
import sys
from flask import Flask, jsonify
from flask_cors import CORS

from .config import PORT, DEBUG
from .database import init_db, get_db_connection
from .cpp_bridge import bridge
from .routes.menu_routes import menu_bp
from .routes.order_routes import order_bp
from .routes.queue_routes import queue_bp
from .routes.staff_routes import staff_bp
from .routes.auth_routes import auth_bp

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    app.register_blueprint(menu_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(queue_bp)
    app.register_blueprint(staff_bp)
    app.register_blueprint(auth_bp)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        engine_status = "unknown"
        try:
            resp = bridge.send_command({"command": "PING"})
            engine_status = resp.get("status", "error")
        except Exception as e:
            engine_status = f"error: {str(e)}"

        return jsonify({
            'status': 'ok',
            'application': 'Smart Canteen API',
            'version': '1.0.0',
            'cpp_engine_status': engine_status
        })

    # Initialize SQLite database and synchronize C++ Engine on startup
    with app.app_context():
        init_db()
        conn = get_db_connection()
        bridge.sync_with_db(conn)
        conn.close()

    return app

app = create_app()

if __name__ == '__main__':
    print(f"Starting Smart Canteen Backend Server on port {PORT}...")
    app.run(host='0.0.0.0', port=PORT, debug=DEBUG)
