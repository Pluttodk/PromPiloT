"""Exception classes for the Prom-Pilot SDK."""


class PromPilotError(Exception):
    """Base exception raised by the Prom-Pilot SDK.

    Attributes:
        status_code: HTTP status code from the API response.
        detail: Human-readable error detail from the API.
    """

    def __init__(self, detail: str, status_code: int) -> None:
        """Initialise with detail message and HTTP status code.

        Args:
            detail: Error detail returned by the API.
            status_code: HTTP status code of the failed response.
        """
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code

    def __repr__(self) -> str:
        return f"{type(self).__name__}(status_code={self.status_code}, detail={self.detail!r})"


class NotFoundError(PromPilotError):
    """Raised when the API returns a 404 Not Found response."""

    def __init__(self, detail: str) -> None:
        """Initialise with a 404 status code.

        Args:
            detail: Error detail returned by the API.
        """
        super().__init__(detail=detail, status_code=404)


class ExecutionError(PromPilotError):
    """Raised when a flow execution or evaluation run fails.

    This covers both 5xx API errors during execution and terminal
    ``failed`` statuses returned from polling an evaluation run.
    """

    def __init__(self, detail: str, status_code: int = 500) -> None:
        """Initialise with detail and optional HTTP status code.

        Args:
            detail: Error detail describing the execution failure.
            status_code: HTTP status code (default 500).
        """
        super().__init__(detail=detail, status_code=status_code)
