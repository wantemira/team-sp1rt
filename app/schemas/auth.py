from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: Literal["client", "employee"]


class ClientProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inn: str
    company_name: str
    client_type: Literal["INDIVIDUAL", "LEGAL_ENTITY"]


class EmployeeProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    position: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["Bearer"] = "Bearer"
    expires_in: int
    user: UserProfile
    client: ClientProfile | None = None
    employee: EmployeeProfile | None = None


class AuthenticatedUserResponse(BaseModel):
    user: UserProfile
    client: ClientProfile | None = None
    employee: EmployeeProfile | None = None
