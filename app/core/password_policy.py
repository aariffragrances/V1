import re

PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$")


def validate_password_strength(password: str) -> str:
    if not PASSWORD_PATTERN.match(password or ""):
        raise ValueError(
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
        )
    return password
