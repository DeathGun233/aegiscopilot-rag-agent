from __future__ import annotations

from ..models import User
from ..repositories import UserRepository


class UserService:
    def __init__(self, repo: UserRepository) -> None:
        self.repo = repo

    def list_users(self) -> list[User]:
        return self.repo.list()

    def get_user(self, user_id: str) -> User:
        user = self.repo.get(user_id)
        if user is None:
            raise KeyError(user_id)
        return user

    def resolve_current_user(self, user_id: str | None = None) -> User:
        if user_id:
            return self.get_user(user_id)
        return self.get_user("admin")
