# API Workflow Rules

## State Machine Base Class

ALWAYS use the `python-statemachine` library's `StateChart` base class. ALWAYS set `atomic_configuration_update = True`. ALWAYS set `catch_errors_as_events = False`.

Example from codebase:
```python
from statemachine import StateChart, State

class OpportunityPublishStateMachine(StateChart):
    atomic_configuration_update = True
    catch_errors_as_events = False

    draft = State(initial=True)
    under_review = State()
    published = State()
    closed = State()

    submit_for_review = draft.to(under_review)
    approve = under_review.to(published)
    reject = under_review.to(draft)
    close = published.to(closed)
```

## Metrics Pattern

ALWAYS define a `Metrics` class as a `StrEnum` inside workflow classes. ALWAYS use `increment()` for tracking workflow events.

## Event Model

ALWAYS use typed event models (`StateMachineEvent`, `SQSMessageContainer`). NEVER pass raw dicts as workflow events. ALWAYS include event metadata (timestamp, actor, source).

## State Persistence

ALWAYS use database-backed persistence via `BaseStatePersistenceModel`. NEVER store workflow state in memory or cache. ALWAYS persist state transitions atomically.

## Listener/Observer Pattern

ALWAYS use the listener pattern for side effects on state transitions. NEVER embed side-effect logic in state machine transition handlers. ALWAYS register listeners via the workflow registry.

## Registry Pattern

ALWAYS use `WorkflowRegistry` and `WorkflowClientRegistry` for registration. NEVER instantiate workflow services directly.

## Approval Processing

ALWAYS use `ApprovalProcessor` for approval workflows. ALWAYS validate actor permissions before processing. ALWAYS record decisions in the audit trail.

## Background Task Execution

ALWAYS use the `workflow_background_task` decorator for ECS container execution.

## Logging

ALWAYS log state transitions with `from_state`, `to_state`, and `entity_id` in `extra={}`. NEVER log PII. ALWAYS use static log message strings.

## Error Handling

ALWAYS let state machine exceptions propagate. NEVER catch and swallow transition errors. ALWAYS validate preconditions before triggering transitions.
