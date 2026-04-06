# API Background Tasks Rules

## File Organization

ALWAYS place each primary service function in its own file within `api/src/task/`. NEVER create standalone task functions outside the Task framework.

## Task Base Class

ALWAYS inherit from the `Task` base class in `api/src/task/task.py`. ALWAYS implement the `run_task()` method as the entry point for task logic.

Example from codebase:
```python
from src.task.task import Task

class ClosingDateNotificationTask(Task):
    class Metrics(StrEnum):
        NOTIFICATIONS_SENT = "notifications_sent"
        OPPORTUNITIES_PROCESSED = "opportunities_processed"

    def run_task(self) -> None:
        ...
```

## Metrics Definition

ALWAYS define a `Metrics` class as a `StrEnum` inside the task class. Metrics are auto-initialized to 0. ALWAYS use `self.increment(Metrics.METRIC_NAME)` to update metrics. NEVER use raw counters or external metric tracking.

## SubTask Composition

ALWAYS use the `SubTask` base class for batch processing operations. ALWAYS implement `has_more_to_process()` to control the batch loop. NEVER process unbounded data sets in a single pass.

## Job Logging

ALWAYS use the `JobLog` database model to track task execution status. Task status transitions: `STARTED` -> `COMPLETED` or `STARTED` -> `FAILED`. ALWAYS update job status in a `finally` block.

## Performance Measurement

ALWAYS use `time.perf_counter()` for timing task execution. NEVER use `time.time()`. ALWAYS log task duration in structured logging `extra={}`.

## Notification Tasks

ALWAYS inherit from `BaseNotificationTask` for email notification tasks. ALWAYS use the Pinpoint adapter for email sending. NEVER call external email services directly.

## ECS Background Task Decorator

ALWAYS use the `ecs_background_task` decorator for tasks that run as ECS containers. This handles NewRelic transaction setup and container lifecycle management.

## Logging

ALWAYS begin every task module with `logger = logging.getLogger(__name__)`. ALWAYS use static log message strings with `extra={}` for dynamic values. NEVER log PII. ALWAYS log task start, completion, and failure events.

## Error Handling

ALWAYS let exceptions propagate to the Task base class. NEVER swallow exceptions silently. ALWAYS use specific exception types, not bare `except Exception`.
