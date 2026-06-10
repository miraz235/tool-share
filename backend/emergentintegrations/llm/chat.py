import json
from dataclasses import dataclass

@dataclass
class UserMessage:
    text: str

class LlmChat:
    def __init__(self, api_key: str, session_id: str, system_message: str = None):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.provider = None
        self.model = None

    def with_model(self, provider: str, model: str):
        self.provider = provider
        self.model = model
        return self

    async def send_message(self, user_message: UserMessage):
        task = getattr(user_message, 'text', '')
        summary = "A simple tool plan for your DIY task."
        if isinstance(task, str) and 'fence' in task.lower():
            summary = "Build a fence using common rental tools."
        tools = [
            {"name": "Circular saw", "category": "power-tools", "why": "to cut boards to length", "essential": True},
            {"name": "Tape measure", "category": "hand-tools", "why": "to measure posts and panels", "essential": True},
            {"name": "Hammer", "category": "hand-tools", "why": "to secure nails and stakes", "essential": True},
            {"name": "Level", "category": "hand-tools", "why": "to keep the fence straight", "essential": False},
        ]
        result = {
            "summary": summary,
            "difficulty": "Moderate",
            "estimated_time": "4-8 hours",
            "tools": tools[:4],
            "safety_tips": ["Wear safety glasses", "Use ear protection", "Keep fingers away from blades"],
        }
        return json.dumps(result)
