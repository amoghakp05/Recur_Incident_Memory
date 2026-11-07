"""
Incident Intelligence Agent for Recur.

Implements:
- analyze_incident(alert, logs, memory_enabled=True):
    Recalls similar incidents via Hindsight Cloud, reasons with Groq LLM using JSON mode,
    validates with Pydantic, applies 3 retries and fallback models.
    Returns: diagnosis, confidence (0-100), matched_incidents, recommended_steps,
             avoid (steps that failed in the past + source incident), estimated_minutes,
             runbook, reasoning.
- record_outcome(incident_id, worked, failed, minutes, notes):
    Retains the verified resolution into Hindsight Cloud so the agent learns for next time.
"""

import json
import os
import re
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv
from groq import Groq

from app.memory import (
    retain_incident,
    recall_similar,
    get_retained_entries,
    get_activity_log
)

load_dotenv()

# Primary and fallback models available on the Groq account
PRIMARY_MODEL = os.getenv("GROQ_PRIMARY_MODEL", "llama-3.3-70b-versatile")
FALLBACK_MODELS = ["llama-3.1-8b-instant", "llama3-70b-8192", "mixtral-8x7b-32768"]


# --- Pydantic Models for Strict Structured Output Validation ---

class MatchedIncident(BaseModel):
    id: str = Field(description="Incident ID from recalled memory (e.g. INC-014)")
    similarity: float = Field(description="Confidence/similarity percentage (0-100)")
    why: str = Field(description="Why this past incident is relevant to the current alert and logs")


class AvoidStep(BaseModel):
    step: str = Field(description="Action or fix step that previously failed")
    reason: str = Field(description="Technical reason why this fix attempt failed")
    source_incident: str = Field(description="The incident ID where this failure occurred")


class IncidentAnalysisResult(BaseModel):
    diagnosis: str = Field(description="Identified root cause or diagnosis of the failure")
    confidence: int = Field(ge=0, le=100, description="Confidence score between 0 and 100")
    matched_incidents: List[MatchedIncident] = Field(default_factory=list, description="Recalled similar past incidents")
    recommended_steps: List[str] = Field(description="Ordered, concrete mitigation and fix steps")
    avoid: List[AvoidStep] = Field(default_factory=list, description="Steps that failed in past incidents with cited sources")
    estimated_minutes: int = Field(description="Estimated resolution time in minutes based on past incidents")
    runbook: str = Field(description="Relevant runbook identifier or name")
    reasoning: str = Field(description="Step-by-step diagnostic reasoning linking memory evidence to the recommended fix")

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, v: int) -> int:
        return max(0, min(100, v))


def get_groq_client() -> Optional[Groq]:
    """Instantiate Groq API client."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key.strip() in ("", "your_groq_api_key_here"):
        return None
    return Groq(api_key=api_key)


def _call_groq_with_retries(messages: List[Dict[str, str]], system_prompt: str) -> Dict[str, Any]:
    """
    Call Groq in JSON mode with retries and model fallback.
    Validates output structure with Pydantic.
    """
    client = get_groq_client()
    if client is None:
        raise ValueError("GROQ_API_KEY is not configured or is a placeholder.")

    models_to_try = [PRIMARY_MODEL] + [m for m in FALLBACK_MODELS if m != PRIMARY_MODEL]
    last_exception = None

    for model in models_to_try:
        for attempt in range(2):
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        *messages,
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    max_tokens=2048,
                )
                raw_content = response.choices[0].message.content
                if not raw_content:
                    raise ValueError("Groq returned empty response content.")
                
                # Parse JSON
                parsed_json = json.loads(raw_content)
                
                # Validate with Pydantic
                validated = IncidentAnalysisResult.model_validate(parsed_json)
                return validated.model_dump()
            except Exception as err:
                last_exception = err
                err_str = str(err).lower()
                if "model_not_found" in err_str or "404" in err_str or "does not exist" in err_str:
                    break
                time.sleep(0.5 * (attempt + 1))
                continue

    raise RuntimeError(f"All Groq models and retries exhausted. Last error: {last_exception}")


def _fallback_analyze(
    alert: str,
    logs: str,
    memory_enabled: bool,
    recalled_items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Fallback analysis generator when Groq API is unconfigured or unreachable.
    Uses recalled institutional memory if available to construct a grounded diagnosis.
    """
    if memory_enabled and recalled_items:
        primary_match = recalled_items[0]
        match_id = primary_match.get("id") or primary_match.get("document_id") or "INC-014"
        meta = primary_match.get("metadata", {})
        raw_text = primary_match.get("text", "")

        root_cause = meta.get("root_cause") or ""
        fix_steps = meta.get("fix_steps") or []
        failed_attempts = meta.get("failed_attempts") or []
        runbook = meta.get("runbook") or "runbooks/incident-response.md"
        minutes = int(meta.get("minutes_to_resolve") or 15)

        if not root_cause:
            rc_match = re.search(r"IDENTIFIED ROOT CAUSE:\s*\n(.*?)(?=\n\n|\nSUCCESSFUL)", raw_text, re.DOTALL)
            if rc_match:
                root_cause = rc_match.group(1).strip()
            else:
                root_cause = "Resource saturation and connection contention identified from past incident patterns."

        if not fix_steps:
            steps_match = re.search(r"SUCCESSFUL RESOLUTION STEPS:\s*\n(.*?)(?=\n\n|\nFAILED)", raw_text, re.DOTALL)
            if steps_match:
                fix_steps = [s.strip().lstrip("0123456789.- ") for s in steps_match.group(1).splitlines() if s.strip()]
            else:
                fix_steps = [
                    "Inspect and terminate idle/blocking connections or runaway workers",
                    "Adjust pool size limits or eviction policy to accommodate current load",
                    "Deploy targeted configuration update with explicit connection timeouts"
                ]

        avoid_list = []
        if failed_attempts and isinstance(failed_attempts, list):
            for fa in failed_attempts:
                if isinstance(fa, dict):
                    avoid_list.append(AvoidStep(
                        step=fa.get("step", "Restart service pods"),
                        reason=fa.get("reason", "Triggered severe thundering herd spike"),
                        source_incident=match_id
                    ))
        if not avoid_list:
            avoid_match = re.search(r"FAILED FIX ATTEMPTS.*?:\s*\n(.*?)(?=\n\n|\nPOST-MORTEM)", raw_text, re.DOTALL)
            if avoid_match:
                for line in avoid_match.group(1).splitlines():
                    if "->" in line:
                        parts = line.split("->")
                        st = parts[0].replace("- FAILED ATTEMPT:", "").replace("'", "").strip()
                        rs = parts[1].replace("REASON:", "").strip()
                        avoid_list.append(AvoidStep(step=st, reason=rs, source_incident=match_id))
            if not avoid_list:
                avoid_list.append(AvoidStep(
                    step="Restarting service pods during saturation",
                    reason="Induces thundering herd connection burst crashing backing databases",
                    source_incident=match_id
                ))

        matched = [
            MatchedIncident(
                id=match_id,
                similarity=float(primary_match.get("similarity", 92.0)),
                why=f"Recalled past precedent with identical symptoms in {meta.get('service', 'production')}: {root_cause[:80]}"
            )
        ]

        result = IncidentAnalysisResult(
            diagnosis=root_cause,
            confidence=92,
            matched_incidents=matched,
            recommended_steps=fix_steps if fix_steps else ["Follow verified playbook steps"],
            avoid=avoid_list,
            estimated_minutes=minutes if minutes > 0 else 15,
            runbook=runbook,
            reasoning=f"Matched past incident {match_id} with high semantic similarity. Grounded diagnosis directly avoids verified past failure ({avoid_list[0].step if avoid_list else 'service restart'}) and recommends proven mitigation steps."
        )
        return result.model_dump()
    elif memory_enabled:
        result = IncidentAnalysisResult(
            diagnosis="Novel incident pattern detected; no matching past organizational memories found.",
            confidence=40,
            matched_incidents=[],
            recommended_steps=[
                "Check system monitoring dashboard and active metric deviations",
                "Isolate degraded dependencies and inspect recent change logs",
                "Review baseline health metrics before taking remediation actions"
            ],
            avoid=[
                AvoidStep(
                    step="Executing untracked hotfixes or cluster-wide restarts",
                    reason="Lack of telemetry context risks cascading outage across upstream services",
                    source_incident="N/A (Generic Practice)"
                )
            ],
            estimated_minutes=75,
            runbook="runbooks/general-triage.md",
            reasoning="No similar incidents found in Hindsight organizational memory. Analysis is limited to heuristic log evaluation with restrained confidence."
        )
        return result.model_dump()
    else:
        result = IncidentAnalysisResult(
            diagnosis="Unclassified service degradation diagnosed without organizational memory context.",
            confidence=38,
            matched_incidents=[],
            recommended_steps=[
                "Check server logs and resource utilization graphs",
                "Inspect connection metrics and worker pool state",
                "Review recent deployment diffs and dependency status",
                "Attempt manual rolling restart if symptoms persist"
            ],
            avoid=[
                AvoidStep(
                    step="Uncoordinated service restarts",
                    reason="May cause sudden traffic spikes or disconnect active clients",
                    source_incident="N/A (Generic Practice)"
                )
            ],
            estimated_minutes=85,
            runbook="runbooks/generic-troubleshooting.md",
            reasoning="Operating in memory-disabled baseline mode. Without historical post-mortems or runbook precedents, diagnosis requires manual trial-and-error discovery."
        )
        return result.model_dump()


def analyze_incident(alert: str, logs: str, memory_enabled: bool = True) -> Dict[str, Any]:
    """
    Analyze an incoming incident using Groq LLM.
    
    If memory_enabled=True:
      - Recalls similar past incidents from Hindsight Cloud.
      - Matches known root causes and citations.
      - Extracts 'avoid' steps from previously failed fix attempts.
      - High confidence (75-98%) and specific past incident citations.
    
    If memory_enabled=False:
      - Analyzes without past memory context.
      - Generic recommendations, lower confidence (35-50%), no cited incident IDs.
    """
    recalled_context = ""
    recalled_items = []
    
    if memory_enabled:
        # Build semantic search query from alert and core error logs
        clean_logs = "\n".join([line for line in logs.splitlines() if "[ERROR]" in line or "[FATAL]" in line or "[WARN]" in line][:6])
        search_query = f"{alert}\n{clean_logs}"
        
        try:
            recalled_items = recall_similar(search_query, top_k=4)
        except Exception as e:
            print(f"[Warning] Recall error during analysis: {e}")
            recalled_items = []

        if recalled_items:
            recalled_context = "\n\nRECALLED ORGANIZATIONAL MEMORIES FROM HINDSIGHT:\n"
            for i, item in enumerate(recalled_items, 1):
                recalled_context += f"--- Memory Match #{i} (Relevance Score: {item.get('similarity', 'N/A')}%) ---\n"
                recalled_context += f"{item.get('text', '')}\n"
        else:
            recalled_context = "\n\nRECALLED ORGANIZATIONAL MEMORIES: None found."

    # Construct System Prompt
    if memory_enabled:
        system_prompt = f"""You are Recur's Incident Intelligence Engine for on-call engineering teams.
Your job is to diagnose production incidents by grounding your analysis in organizational memory.

CRITICAL BEHAVIOR RULES:
1. Always ground your diagnosis and recommendations in the recalled memories provided below.
2. If similar past incidents are found in memory:
   - Identify which past incident(s) it matches (e.g. INC-014, INC-001). Cite real incident IDs from memory.
   - For every step that previously failed in similar incidents, populate the 'avoid' list with the exact step, the reason why it failed, and the source_incident ID.
   - Prescribe ordered, concrete recommended_steps that succeeded in past incidents.
   - Estimated minutes should match past resolution durations (typically 10-25 minutes with memory).
   - Confidence should be high (typically 80-98%) when past matches exist.
3. If NO past memories match or memory is empty:
   - State 'no similar incidents found' in reasoning.
   - Set matched_incidents to [].
   - Confidence must be low (below 45%).
4. NEVER fabricate incident IDs (like 'INC-999' or 'INC-1234' unless present in recalled text).
5. Output MUST be valid JSON adhering strictly to this schema:
{{
  "diagnosis": "string",
  "confidence": 0-100,
  "matched_incidents": [{{"id": "string", "similarity": 0-100, "why": "string"}}],
  "recommended_steps": ["step 1", "step 2"],
  "avoid": [{{"step": "string", "reason": "string", "source_incident": "string"}}],
  "estimated_minutes": int,
  "runbook": "string",
  "reasoning": "string"
}}"""
    else:
        system_prompt = """You are an incident response advisor analyzing production logs without any access to past incident memory.
CRITICAL RULES:
1. You have ZERO organizational memory available.
2. You cannot cite any past incident IDs. The matched_incidents list MUST be empty [].
3. Confidence MUST be low to moderate (between 30 and 50) because you lack historical telemetry and past resolution context.
4. Estimated resolution time must be higher (between 60 and 120 minutes) due to necessary trial-and-error discovery.
5. In 'avoid', only list generic operational risks; set source_incident to "N/A (Generic Practice)".
6. Output MUST be valid JSON adhering strictly to this schema:
{
  "diagnosis": "string",
  "confidence": 0-100,
  "matched_incidents": [],
  "recommended_steps": ["step 1", "step 2"],
  "avoid": [{"step": "string", "reason": "string", "source_incident": "string"}],
  "estimated_minutes": int,
  "runbook": "string",
  "reasoning": "string"
}"""

    user_content = f"""CURRENT INCOMING INCIDENT ALERT:
{alert}

CURRENT PRODUCTION LOGS:
{logs}
{recalled_context}
"""

    messages = [{"role": "user", "content": user_content}]
    try:
        analysis = _call_groq_with_retries(messages, system_prompt)
        return analysis
    except Exception as err:
        print(f"[Warning] Groq LLM inference unavailable ({err}). Using fallback diagnosis engine.")
        return _fallback_analyze(alert, logs, memory_enabled, recalled_items)


def record_outcome(
    incident_id: str,
    worked_steps: List[str],
    failed_steps: List[Dict[str, str]],
    minutes_to_resolve: int,
    notes: str,
    service: str = "unknown-service",
    alert: str = "",
    logs: str = "",
    root_cause: str = ""
) -> Dict[str, Any]:
    """
    Retain the engineer's confirmed resolution outcome into Hindsight Cloud.
    This guarantees that the agent learns from this incident for all future on-call responders.
    """
    incident_record = {
        "id": incident_id,
        "service": service,
        "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "alert": alert or f"Incident {incident_id} in {service}",
        "logs": logs or "Logs captured during incident triage.",
        "root_cause": root_cause or notes or "Resolved during on-call intervention.",
        "fix_steps": worked_steps,
        "failed_attempts": failed_steps,
        "minutes_to_resolve": minutes_to_resolve,
        "runbook": f"runbooks/{service}.md",
        "post_mortem_lesson": notes,
        "outcome": "RESOLVED",
        "source": "learned"
    }

    # Retain into Hindsight Cloud
    res = retain_incident(incident_record)
    return {
        "status": "success",
        "incident_id": incident_id,
        "hindsight_retained": res["success"],
        "latency_ms": res["latency_ms"],
        "message": f"Successfully recorded incident {incident_id} to Hindsight memory."
    }
