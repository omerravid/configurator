-- Configuration Manager Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'USER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Configurations table
CREATE TABLE IF NOT EXISTS configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('PRODUCT', 'INSTANCE', 'USER')),
    parent_id UUID REFERENCES configurations(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'COMMITTED' CHECK (status IN ('DRAFT', 'COMMITTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    description TEXT,
    
    -- Constraints
    CONSTRAINT chk_product_no_parent CHECK (
        (type = 'PRODUCT' AND parent_id IS NULL) OR 
        (type != 'PRODUCT')
    ),
    CONSTRAINT chk_user_status CHECK (
        (type = 'USER') OR 
        (type != 'USER' AND status = 'COMMITTED')
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_configurations_parent_id ON configurations(parent_id);
CREATE INDEX IF NOT EXISTS idx_configurations_type ON configurations(type);
CREATE INDEX IF NOT EXISTS idx_configurations_status ON configurations(status);
CREATE INDEX IF NOT EXISTS idx_configurations_created_by ON configurations(created_by);
CREATE INDEX IF NOT EXISTS idx_configurations_data_gin ON configurations USING GIN (data);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

-- Insert sample configurations
DO $$
DECLARE
    admin_id UUID;
    product_id UUID;
    instance_id UUID;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_id FROM users WHERE username = 'admin';
    
    -- Insert sample product configuration
    INSERT INTO configurations (name, type, parent_id, data, created_by, description)
    VALUES (
        'prod_ecommerce',
        'PRODUCT',
        NULL,
        '{
            "system": {
                "logging": {
                    "level": "INFO",
                    "retention_days": 30
                },
                "api_keys": ["key1", "key2"],
                "database": {
                    "connection_pool_size": 10,
                    "timeout": 5000
                }
            },
            "feature_flags": {
                "new_ui": false,
                "beta_feature": false,
                "analytics": true
            },
            "business": {
                "tax_rate": 0.08,
                "shipping_cost": 9.99
            }
        }',
        admin_id,
        'Main ecommerce product configuration'
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO product_id;
    
    -- Get product ID if it already exists
    IF product_id IS NULL THEN
        SELECT id INTO product_id FROM configurations WHERE name = 'prod_ecommerce';
    END IF;
    
    -- Insert sample instance configuration
    INSERT INTO configurations (name, type, parent_id, data, created_by, description)
    VALUES (
        'inst_staging_eu',
        'INSTANCE',
        product_id,
        '{
            "system": {
                "logging": {
                    "level": "DEBUG"
                },
                "database": {
                    "connection_pool_size": 5
                }
            },
            "feature_flags": {
                "new_ui": true,
                "beta_feature": true
            }
        }',
        admin_id,
        'Staging environment for EU region'
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO instance_id;
    
    -- Get instance ID if it already exists
    IF instance_id IS NULL THEN
        SELECT id INTO instance_id FROM configurations WHERE name = 'inst_staging_eu';
    END IF;
    
    -- Insert sample user configuration
    INSERT INTO configurations (name, type, parent_id, data, status, created_by, description)
    VALUES (
        'user_dev_john_v1',
        'USER',
        instance_id,
        '{
            "system": {
                "logging": {
                    "retention_days": 7
                }
            },
            "business": {
                "tax_rate": 0.0
            }
        }',
        'DRAFT',
        admin_id,
        'John developer personal configuration'
    )
    ON CONFLICT (name) DO NOTHING;
END $$;
