package configmanager

// UsersListResponse represents users list response
type UsersListResponse struct {
	Users []User `json:"users"`
}

// UserResponse represents user response
type UserResponse struct {
	User User `json:"user"`
}

// UpdateUserRoleRequest represents update user role request
type UpdateUserRoleRequest struct {
	Role string `json:"role"`
}

// UserRoleUpdateResponse represents user role update response
type UserRoleUpdateResponse struct {
	Message string `json:"message"`
	User    User   `json:"user"`
}

// UserDeletionResponse represents user deletion response
type UserDeletionResponse struct {
	Message     string      `json:"message"`
	DeletedUser UserSummary `json:"deletedUser"`
}

// UserSummary represents user summary
type UserSummary struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// UserConfigurationsResponse represents user configurations response
type UserConfigurationsResponse struct {
	Configurations []Configuration `json:"configurations"`
}

// UserService provides user management operations
type UserService struct {
	client *HTTPClient
}

// NewUserService creates a new user service
func NewUserService(client *HTTPClient) *UserService {
	return &UserService{client: client}
}
