"""Tool registry for Agentic AI."""

from __future__ import annotations

import ast
import json
import operator
import urllib.parse
import urllib.request
from collections.abc import Callable


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


_BIN_OPS: dict[type, Callable[[float, float], float]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY_OPS: dict[type, Callable[[float], float]] = {ast.UAdd: operator.pos, ast.USub: operator.neg}
# Bounds keep every intermediate cheap: `9**9**9**9` would otherwise pin a CPU indefinitely.
_MAX_EXPRESSION_LEN = 500
_MAX_EXPONENT = 100
_MAX_MAGNITUDE = 1e100


def _eval_arithmetic(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval_arithmetic(node.body)
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return node.value
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPS:
        return _UNARY_OPS[type(node.op)](_eval_arithmetic(node.operand))
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN_OPS:
        left, right = _eval_arithmetic(node.left), _eval_arithmetic(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > _MAX_EXPONENT:
            raise ValueError(f"exponent larger than {_MAX_EXPONENT}")
        result = _BIN_OPS[type(node.op)](left, right)
        if isinstance(result, complex) or abs(result) > _MAX_MAGNITUDE:
            raise ValueError("result out of range")
        return result
    raise ValueError("only numbers and + - * / // % ** ( ) are allowed")


def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression without eval(): parse to an AST and walk only
    numeric literals and arithmetic operators, with bounded exponents and magnitudes."""
    if len(expression) > _MAX_EXPRESSION_LEN:
        return "Calculator error: expression too long."
    try:
        return str(_eval_arithmetic(ast.parse(expression, mode="eval")))
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
        description="Evaluate arithmetic expressions with + - * / // % ** and parentheses (e.g. 2 + 2, (5 * 4) / 2, 2 ** 10).",
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
