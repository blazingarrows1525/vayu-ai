"""Tool registry for Agentic AI."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any, Callable


class Tool:
    def __init__(
        self,
        name: str,
        description: str,
        parameters: dict,
        func: Callable[..., str],
    ):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.func = func

    def to_openai_dict(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }

    def execute(self, arguments: str) -> str:
        try:
            kwargs = json.loads(arguments)
            return str(self.func(**kwargs))
        except Exception as e:
            return f"Error executing {self.name}: {e}"


def search_wikipedia(query: str) -> str:
    """Search Wikipedia and return a short summary."""
    try:
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query)}&utf8=&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "VayuAI/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            search_results = data.get("query", {}).get("search", [])
            if not search_results:
                return "No results found."
            
            # Just take the first result's snippet
            snippet = search_results[0].get("snippet", "")
            title = search_results[0].get("title", "")
            # Remove HTML tags from snippet
            import re
            clean_snippet = re.sub(r'<[^>]+>', '', snippet)
            return f"Title: {title}\nSummary: {clean_snippet}"
    except Exception as e:
        return f"Wikipedia search failed: {e}"


def calculator(expression: str) -> str:
    """Evaluate a mathematical expression safely."""
    try:
        # Very restricted eval
        allowed = "0123456789+-*/(). "
        if any(c not in allowed for c in expression):
            return "Error: Invalid characters in expression."
        return str(eval(expression, {"__builtins__": None}, {}))
    except Exception as e:
        return f"Calculator error: {e}"


TOOLS = [
    Tool(
        name="search_wikipedia",
        description="Search Wikipedia for information about entities, events, or facts. Returns a brief summary of the best match.",
        parameters={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query, e.g., 'Albert Einstein'"
                }
            },
            "required": ["query"],
        },
        func=search_wikipedia,
    ),
    Tool(
        name="calculator",
        description="Evaluate basic mathematical expressions (e.g. 2 + 2, (5 * 4) / 2).",
        parameters={
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "The mathematical expression to evaluate."
                }
            },
            "required": ["expression"],
        },
        func=calculator,
    ),
]

def get_tools_dict() -> list[dict]:
    return [t.to_openai_dict() for t in TOOLS]

def execute_tool(name: str, arguments: str) -> str:
    for t in TOOLS:
        if t.name == name:
            return t.execute(arguments)
    return f"Error: Tool {name} not found."
