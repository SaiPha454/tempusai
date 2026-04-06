from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock


@dataclass(frozen=True)
class ChatTurn:
    role: str
    content: str


class InMemoryChatSessionStore:
    def __init__(self, max_turns_per_session: int = 20) -> None:
        self.max_turns_per_session = max_turns_per_session
        self._sessions: dict[str, deque[ChatTurn]] = defaultdict(
            lambda: deque(maxlen=self.max_turns_per_session)
        )
        self._lock = Lock()

    def get_recent_turns(self, session_id: str, limit: int = 6) -> list[ChatTurn]:
        with self._lock:
            turns = list(self._sessions.get(session_id, deque()))
        return turns[-limit:]

    def append_turn(self, session_id: str, role: str, content: str) -> None:
        with self._lock:
            self._sessions[session_id].append(ChatTurn(role=role, content=content))


chat_session_store = InMemoryChatSessionStore()
