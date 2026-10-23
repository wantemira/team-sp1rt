from fastapi import APIRouter, HTTPException, Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from db import get_db
from config import JWT_SECRET, JWT_ALGORITHM
import models
import jwt
import bcrypt

router = APIRouter()
security = HTTPBearer()

# --- Схемы данных (Pydantic) ---

class User(BaseModel):
    username: str
    password: str

class UserRegister(BaseModel):
    username: str
    password: str


# --- Ручки (Endpoints) ---

@router.post('/auth/login')
def login(user_data: User, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_bytes = user_data.password.encode('utf-8')
    hashed_bytes = db_user.password.encode('utf-8')
    
    if not bcrypt.checkpw(password_bytes, hashed_bytes):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    payload = {
        "sub": db_user.username,
        "user_id": db_user.id,
        "role": db_user.role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return {"access_token": token, "token_type": "bearer"}


@router.post('/auth/register')
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), salt).decode('utf-8')
    
    new_user = models.User(
        username=user_data.username, 
        password=hashed_password, 
        role="client"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"id": new_user.id, "username": new_user.username, "role": new_user.role}


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get('/auth/me')
def me(payload: dict = Depends(get_current_user)):
    return {"username": payload["sub"], "role": payload["role"]}


def require_role(required_role: str):
    def role_checker(payload: dict = Depends(get_current_user)):
        if payload.get("role") != required_role:
            raise HTTPException(status_code=403, detail=f"Access denied. Requires {required_role} role.")
        return payload
    return role_checker

def get_current_client(payload: dict = Depends(get_current_user)):
    if payload.get("role") != 'client':
        raise HTTPException(status_code=403, detail="Access denied. Requires client role.")
    return payload

def get_current_manager(payload: dict = Depends(get_current_user)):
    if payload.get("role") != "manager":
        raise HTTPException(status_code=403, detail="Access denied. Requires manager role.")
    return payload