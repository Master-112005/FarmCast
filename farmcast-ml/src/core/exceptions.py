"""FarmCast domain exceptions."""


class FarmCastError(Exception):
    """Base class for platform exceptions."""


class ConfigError(FarmCastError):
    """Raised when configuration is missing or malformed."""


class SchemaValidationError(FarmCastError):
    """Raised when schema files are invalid."""


class DatasetValidationError(FarmCastError):
    """Raised when a dataset fails validation rules."""


class TrainingAbortError(FarmCastError):
    """Raised when safety thresholds force a training abort."""


class RegistryError(FarmCastError):
    """Raised when model registry operations fail."""


class PromotionError(FarmCastError):
    """Raised when promotion checks fail."""


class DriftError(FarmCastError):
    """Raised when drift monitoring execution fails."""


class InferenceError(FarmCastError):
    """Raised when inference execution fails."""


class AuthError(FarmCastError):
    """Raised when API authentication fails."""
