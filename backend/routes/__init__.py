"""Route modules for the ToolShare API.

Each submodule exposes a `router: APIRouter` that gets mounted on the `/api`
prefix in `server.py`. Shared infrastructure (db, deps, models, helpers) lives
in `app/backend/core.py`.
"""
