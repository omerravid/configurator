package types

import "time"

type Role string

const (
	RoleAdmin Role = "ADMIN"
	RoleUser  Role = "USER"
)

type User struct {
	ID           string    `bson:"_id,omitempty" json:"id"`
	Username     string    `bson:"username" json:"username" validate:"required,min=3,max=50"`
	PasswordHash string    `bson:"password_hash" json:"-"`
	Role         Role      `bson:"role" json:"role" validate:"oneof=ADMIN USER"`
	CreatedAt    time.Time `bson:"created_at" json:"created_at,omitempty"`
	UpdatedAt    time.Time `bson:"updated_at" json:"updated_at,omitempty"`
}

type LoginRequest struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Password string `json:"password" validate:"required,min=6"`
}

type RegisterRequest struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Password string `json:"password" validate:"required,min=6"`
	Role     Role   `json:"role" validate:"omitempty,oneof=ADMIN USER"`
}

type AuthResponse struct {
	Message string      `json:"message"`
	Token   string      `json:"token"`
	User    interface{} `json:"user"`
}
