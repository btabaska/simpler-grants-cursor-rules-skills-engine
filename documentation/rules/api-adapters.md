# API Adapters Rules

## Config Pattern

ALWAYS define adapter configuration as a class inheriting from `PydanticBaseEnvConfig`. ALWAYS use an env prefix to namespace environment variables. NEVER read environment variables directly with `os.getenv()`.

Example from codebase:
```python
from src.util.env_config import PydanticBaseEnvConfig

class OpensearchConfig(PydanticBaseEnvConfig):
    model_config = SettingsConfigDict(env_prefix="OPENSEARCH_")

    host: str = "localhost"
    port: int = 9200
    use_ssl: bool = True
```

## Retry Logic

ALWAYS use `tenacity` for retry logic. ALWAYS use `@retry` with `stop=stop_after_attempt(N)` and `wait=wait_random_exponential()`. NEVER implement custom retry loops. NEVER retry on non-transient errors (4xx).

## Factory Pattern

ALWAYS use factory functions or classes for adapter instantiation when the adapter has multiple implementations. NEVER instantiate adapters with complex configuration inline.

## Mock Clients

ALWAYS provide dedicated mock client classes for testing. NEVER mock at the method level when a full mock client class exists. ALWAYS place mock clients adjacent to their real counterparts.

## Client Class Structure

ALWAYS encapsulate external API communication in a client class. ALWAYS accept a config object in the constructor. NEVER expose raw HTTP clients to calling code. ALWAYS return typed response objects, not raw dicts.

## Session Management

ALWAYS pass database session objects explicitly. NEVER create sessions inside adapters. NEVER store sessions as instance variables.

## Error Mapping

ALWAYS map external service errors to internal exception types. NEVER let raw third-party exceptions propagate to service layer code. ALWAYS log the original error before re-raising.

## Adapter Boundaries

NEVER call external services directly from the service layer. NEVER import adapter implementation details into route or service code.

## Type Decorators

ALWAYS place custom SQLAlchemy type decorators in `api/src/adapters/db/type_decorators/`.

## Logging

ALWAYS begin every adapter module with `logger = logging.getLogger(__name__)`. NEVER log credentials, tokens, or PII. ALWAYS log external service call outcomes.
