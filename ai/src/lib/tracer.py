import os
import asyncio
import functools
import uuid
from typing import Callable, TypeVar, ParamSpec

_tracer = None
_tracing_enabled = False

try:
    from openinference.instrumentation import using_session
    from openinference.semconv.trace import SpanAttributes
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from openinference.instrumentation.crewai import CrewAIInstrumentor
    from openinference.instrumentation.litellm import LiteLLMInstrumentor
    from phoenix.otel import register

    PROJECT_NAME = os.getenv("PHOENIX_PROJECT_NAME")
    PHOENIX_COLLECTOR_ENDPOINT = os.getenv("PHOENIX_COLLECTOR_ENDPOINT")

    if PROJECT_NAME and PHOENIX_COLLECTOR_ENDPOINT:
        tracer_provider = register(project_name=PROJECT_NAME, set_global_tracer_provider=False)
        tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(PHOENIX_COLLECTOR_ENDPOINT)))
        CrewAIInstrumentor().instrument(tracer_provider=tracer_provider)
        LiteLLMInstrumentor().instrument(tracer_provider=tracer_provider)
        _tracer = trace.get_tracer(__name__)
        _tracing_enabled = True
except Exception as e:
    print(f"Phoenix tracing disabled: {e}")

if _tracer is None:
    from opentelemetry import trace
    _tracer = trace.get_tracer(__name__)

P = ParamSpec('P')
T = TypeVar('T')

def traceable(func: Callable[P, T]) -> Callable[P, T]:
    """
    A decorator that sets up tracing for test functions.
    It creates a new trace session and span for each test execution.
    """
    if not _tracing_enabled:
        return func

    @functools.wraps(func)
    def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        from openinference.instrumentation import using_session
        from openinference.semconv.trace import SpanAttributes
        session_id = str(uuid.uuid4())
        with _tracer.start_as_current_span(
                name=func.__name__,
                attributes={
                    SpanAttributes.OPENINFERENCE_SPAN_KIND: "agent",
                    SpanAttributes.SESSION_ID: session_id
                }
            ) as span:
            with using_session(session_id):
                result = func(*args, **kwargs)
                return result

    @functools.wraps(func)
    async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        from openinference.instrumentation import using_session
        from openinference.semconv.trace import SpanAttributes
        session_id = str(uuid.uuid4())
        with _tracer.start_as_current_span(
            name=func.__name__,
            attributes={
                SpanAttributes.OPENINFERENCE_SPAN_KIND: "agent",
                SpanAttributes.SESSION_ID: session_id
            }
        ) as span:
            with using_session(session_id):
                result = await func(*args, **kwargs)
                return result

    return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

tracer = _tracer
__all__ = ["traceable", "tracer"]
