"""Rules management service for Configuration Manager API."""

from typing import Optional
from urllib.parse import quote

from ..http_client import HTTPClient
from ..models.rules import (
    GetRulesOptions,
    RulesListResponse,
    CreateRuleRequest,
    UpdateRuleRequest,
    RuleResponse,
    ValidateRuleRequest,
    RuleValidationResponse,
    GetRulesForPathOptions,
)
from ..exceptions import ValidationError
from ..utils import from_dict


class RulesService:
    """Rules management service client."""

    def __init__(self, http_client: HTTPClient):
        """Initialize rules service.
        
        Args:
            http_client: HTTP client instance
        """
        self.client = http_client

    def get_all(self, options: GetRulesOptions) -> RulesListResponse:
        """Get rules for a configuration.
        
        Args:
            options: Options containing configuration ID
            
        Returns:
            RulesListResponse containing list of rules
            
        Raises:
            ValidationError: If configuration_id is empty
        """
        if not options.configuration_id:
            raise ValidationError("Configuration ID is required")

        params = {"configurationId": options.configuration_id}
        response = self.client.get("/rules", params=params)
        return from_dict(RulesListResponse, response.json())

    def create(self, request: CreateRuleRequest) -> RuleResponse:
        """Create a new rule.
        
        Args:
            request: Create rule request
            
        Returns:
            RuleResponse containing created rule
            
        Raises:
            ValidationError: If request is invalid
        """
        if not request.configuration_id:
            raise ValidationError("Configuration ID cannot be empty")

        if not request.property_path:
            raise ValidationError("Property path cannot be empty")

        data = {
            "configurationId": request.configuration_id,
            "propertyPath": request.property_path,
            "ruleType": request.rule_type.value,
            "ruleConfig": request.rule_config,
        }

        if request.error_message:
            data["errorMessage"] = request.error_message

        if request.enabled is not None:
            data["enabled"] = request.enabled

        response = self.client.post("/rules", json_data=data)
        return from_dict(RuleResponse, response.json())

    def get(self, rule_id: str) -> RuleResponse:
        """Get a specific rule by ID.
        
        Args:
            rule_id: Rule ID
            
        Returns:
            RuleResponse containing rule information
            
        Raises:
            ValidationError: If rule_id is empty
        """
        if not rule_id:
            raise ValidationError("Rule ID cannot be empty")

        response = self.client.get(f"/rules/{rule_id}")
        return from_dict(RuleResponse, response.json())

    def update(self, rule_id: str, request: UpdateRuleRequest) -> RuleResponse:
        """Update an existing rule.
        
        Args:
            rule_id: Rule ID
            request: Update rule request
            
        Returns:
            RuleResponse containing updated rule
            
        Raises:
            ValidationError: If rule_id is empty
        """
        if not rule_id:
            raise ValidationError("Rule ID cannot be empty")

        data = {}

        if request.property_path:
            data["propertyPath"] = request.property_path

        if request.rule_type:
            data["ruleType"] = request.rule_type.value

        if request.rule_config is not None:
            data["ruleConfig"] = request.rule_config

        if request.error_message is not None:
            data["errorMessage"] = request.error_message

        if request.enabled is not None:
            data["enabled"] = request.enabled

        response = self.client.put(f"/rules/{rule_id}", json_data=data)
        return from_dict(RuleResponse, response.json())

    def delete(self, rule_id: str) -> None:
        """Delete a rule.
        
        Args:
            rule_id: Rule ID
            
        Raises:
            ValidationError: If rule_id is empty
        """
        if not rule_id:
            raise ValidationError("Rule ID cannot be empty")

        self.client.delete(f"/rules/{rule_id}")

    def validate(self, request: ValidateRuleRequest) -> RuleValidationResponse:
        """Validate a value against rules.
        
        Args:
            request: Validate rule request
            
        Returns:
            RuleValidationResponse containing validation result
            
        Raises:
            ValidationError: If request is invalid
        """
        if not request.configuration_id:
            raise ValidationError("Configuration ID cannot be empty")

        if not request.property_path:
            raise ValidationError("Property path cannot be empty")

        data = {
            "configurationId": request.configuration_id,
            "propertyPath": request.property_path,
            "value": request.value,
        }

        response = self.client.post("/rules/validate", json_data=data)
        return from_dict(RuleValidationResponse, response.json())

    def get_for_path(
        self,
        config_id: str,
        path: str,
        options: Optional[GetRulesForPathOptions] = None,
    ) -> RulesListResponse:
        """Get rules for a specific configuration and path.
        
        Args:
            config_id: Configuration ID
            path: Property path
            options: Options for getting rules
            
        Returns:
            RulesListResponse containing rules for the path
            
        Raises:
            ValidationError: If parameters are invalid
        """
        if not config_id:
            raise ValidationError("Configuration ID cannot be empty")

        if not path:
            raise ValidationError("Path cannot be empty")

        # URL encode the path
        encoded_path = quote(path, safe='')
        endpoint = f"/rules/configuration/{config_id}/path/{encoded_path}"

        params = {}
        if options and options.include_inherited is not None:
            params["includeInherited"] = "true" if options.include_inherited else "false"

        response = self.client.get(endpoint, params=params)
        return from_dict(RulesListResponse, response.json())
