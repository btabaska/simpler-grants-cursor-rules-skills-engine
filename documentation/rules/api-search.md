# API Search (OpenSearch) Rules

## Index Configuration

ALWAYS centralize analyzer configuration in `DEFAULT_INDEX_ANALYSIS`. NEVER define custom analyzers per-index. ALWAYS use configurable shards and replicas.

Example from codebase:
```python
DEFAULT_INDEX_ANALYSIS = {
    "analysis": {
        "filter": {
            "snowball_filter": {"type": "snowball", "language": "English"}
        },
        "analyzer": {
            "default_analyzer": {
                "type": "custom",
                "tokenizer": "standard",
                "filter": ["lowercase", "snowball_filter"],
            }
        },
    }
}
```

## Query Building

ALWAYS use the `opensearch_query_builder` module for constructing queries. NEVER build raw DSL dicts inline. ALWAYS use structured filter, aggregation, and sort builders.

## Response Transformation

ALWAYS use typed `SearchResponse` objects. NEVER return raw OpenSearch response dicts. ALWAYS map `_source` fields to domain model attributes.

## Batch Indexing

ALWAYS use dedicated load tasks for bulk indexing. NEVER index documents one-at-a-time in production. ALWAYS use the bulk API.

## Index Management

ALWAYS apply `DEFAULT_INDEX_ANALYSIS` when creating indexes. NEVER hard-code index names — use config-driven naming with optional namespace prefix.

## Query Explain

ALWAYS support the explain endpoint for query debugging.

## Count Optimization

ALWAYS use `count(DISTINCT(primary_key))` for record counts. NEVER use `len(results)` — use OpenSearch `total` value.

## Logging

ALWAYS log search queries and result counts. NEVER log full result payloads. NEVER log user search terms as PII.
