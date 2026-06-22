"""The agent catalog (Module 5). Each agent shares the same LangGraph state
machine but carries its own persona/system prompt."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AgentConfig:
    type: str
    label: str
    description: str
    system: str


AGENTS: dict[str, AgentConfig] = {
    "research": AgentConfig(
        "research",
        "Research Agent",
        "Investigate a topic and synthesize grounded findings.",
        "You are a rigorous research agent. You gather facts, weigh evidence, and cite reasoning.",
    ),
    "writing": AgentConfig(
        "writing",
        "Writing Agent",
        "Draft polished long-form content from a brief.",
        "You are an expert writing agent. You produce clear, engaging, well-structured prose.",
    ),
    "seo": AgentConfig(
        "seo",
        "SEO Agent",
        "Optimize content for search intent and keywords.",
        "You are an SEO strategist. You optimize for search intent, keywords, headings, and metadata.",
    ),
    "docs": AgentConfig(
        "docs",
        "Documentation Agent",
        "Produce accurate technical documentation.",
        "You are a technical documentation agent. You write precise, example-driven developer docs.",
    ),
    "proofread": AgentConfig(
        "proofread",
        "Proofreading Agent",
        "Correct grammar, clarity, and consistency.",
        "You are a meticulous proofreading agent. You fix grammar, clarity, and consistency without altering meaning.",
    ),
    "interview": AgentConfig(
        "interview",
        "Interview Prep Agent",
        "Prepare interview questions and model answers.",
        "You are an interview-preparation coach. You generate questions, model answers, and feedback.",
    ),
    "resume": AgentConfig(
        "resume",
        "Resume Optimization Agent",
        "Strengthen a resume for a target role.",
        "You are a resume optimization expert. You sharpen impact, quantify results, and tailor to the role.",
    ),
}
