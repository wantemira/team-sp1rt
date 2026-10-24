import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite://")
os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-not-used-outside-tests")
os.environ.setdefault("UPLOAD_DIR", "storage/test-uploads")
