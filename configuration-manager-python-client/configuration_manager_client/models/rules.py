"""Rules management models for Configuration Manager client."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any, Dict, List

from .types import RuleType


@dataclass
class Rule:
    """Validation rule entity."""
    id: str
    configuration_id: str
    property_path: str
    rule_type: RuleType
    rule_config: Dict[str, Any]
    error_message: Optional[str]
    enabled: bool
    created_at: datetime
    updated_at: datetime


@dataclass
class RulesListResponse:
    """Rules list response."""
    rules: List[Rule]


@dataclass
class CreateRuleRequest:
    """Create rule request."""
    configuration_id: str
    property_path: str
    rule_type: RuleType
    rule_config: Dict[str, Any]
    error_message: Optional[str] = None
    enabled: Optional[bool] = None


@dataclass
class UpdateRuleRequest:
    """Update rule request."""
    property_path: Optional[str] = None
    rule_type: Optional[RuleType] = None
    rule_config: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    enabled: Optional[bool] = None


@dataclass
class RuleResponse:
    """Rule response."""
    rule: Rule


@dataclass
class ValidateRuleRequest:
    """Rule validation request."""
    configuration_id: str
    property_path: str
    value: Any


@dataclass
class RuleValidationResponse:
    """Rule validation response."""
    valid: bool
    errors: Optional[List[str]] = None
    warnings: Optional[List[str]] = None


@dataclass
class GetRulesOptions:
    """Options for getting rules."""
    configuration_id: str


@dataclass
class GetRulesForPathOptions:
    """Options for getting rules for a specific path."""
    include_inherited: Optional[bool] = None


@dataclass
class NumericRuleConfig:
    """Numeric rule configuration."""
    min: Optional[float] = None
    max: Optional[float] = None
    step: Optional[float] = None
    required: bool = False


@dataclass  
class PatternRuleConfig:
    """Pattern rule configuration."""
    pattern: str
    flags: Optional[str] = None
    required: bool = False


@dataclass
class CollectionRuleConfig:
    """Collection rule configuration."""
    allowed_values: Optional[List[Any]] = None
    min_items: Optional[int] = None
    max_items: Optional[int] = None
    unique_items: bool = False
    required: bool = False
