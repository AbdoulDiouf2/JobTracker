import os
import sys

# Add the backend directory to sys.path to resolve relative imports
# os.path.dirname(os.path.abspath(__file__)) is '.../backend/api'
# Two dirnames up puts us in '.../backend', which allows importing 'config', 'routes', etc.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app

# Vercel Serverless Function Entry Point
# This file exposes the 'app' object which Vercel's Python runtime will use to serve requests.
