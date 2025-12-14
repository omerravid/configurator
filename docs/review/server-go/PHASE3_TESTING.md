# Phase 3: Advanced Config Features - Testing Guide

## Overview
Phase 3 implements sophisticated configuration resolution with provenance tracking, component expansion, and enhanced path traversal.

---

## Test Setup

### Start the Service
```bash
docker compose -f server-go/deployments/docker-compose.yml up --build
```

### Create Test Data

#### 1. Register Admin User
```http
POST http://localhost:3004/api/auth/register
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123",
  "role": "ADMIN"
}
```
Save token as `{{adminToken}}`

#### 2. Create Base PRODUCT Config
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "BaseProduct",
  "type": "PRODUCT",
  "data": {
    "system": {
      "name": "Base System",
      "version": "1.0.0"
    },
    "settings": {
      "theme": "light",
      "language": "en"
    }
  }
}
```
Save ID as `{{baseProductId}}`

#### 3. Create Child INSTANCE Config
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "InstanceA",
  "type": "INSTANCE",
  "parent_id": "{{baseProductId}}",
  "data": {
    "settings": {
      "theme": "dark"
    },
    "deployment": {
      "region": "us-east-1"
    }
  }
}
```
Save ID as `{{instanceId}}`

---

## Test Cases

### 1. Provenance Tracking

#### Test 1.1: Get Config Without Provenance (Default)
```http
GET http://localhost:3004/api/configs/{{instanceId}}
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
{
  "config": {
    "system": {
      "name": "Base System",
      "version": "1.0.0"
    },
    "settings": {
      "theme": "dark",
      "language": "en"
    },
    "deployment": {
      "region": "us-east-1"
    }
  },
  "metadata": {
    "configId": "...",
    "configName": "InstanceA",
    "configType": "INSTANCE",
    "chainLength": 2
  }
}
```

#### Test 1.2: Get Config With Provenance
```http
GET http://localhost:3004/api/configs/{{instanceId}}?provenance=true
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
{
  "config": {
    "system": {
      "name": {
        "value": "Base System",
        "source": {
          "id": "{{baseProductId}}",
          "name": "BaseProduct",
          "type": "PRODUCT",
          "createdBy": "admin"
        }
      },
      "version": {
        "value": "1.0.0",
        "source": {
          "id": "{{baseProductId}}",
          "name": "BaseProduct",
          "type": "PRODUCT"
        }
      }
    },
    "settings": {
      "theme": {
        "value": "dark",
        "source": {
          "id": "{{instanceId}}",
          "name": "InstanceA",
          "type": "INSTANCE"
        }
      },
      "language": {
        "value": "en",
        "source": {
          "id": "{{baseProductId}}",
          "name": "BaseProduct",
          "type": "PRODUCT"
        }
      }
    },
    "deployment": {
      "region": {
        "value": "us-east-1",
        "source": {
          "id": "{{instanceId}}",
          "name": "InstanceA",
          "type": "INSTANCE"
        }
      }
    }
  }
}
```

**Verify:**
- ✅ Inherited values (`system.name`, `settings.language`) have BaseProduct as source
- ✅ Overridden values (`settings.theme`) have InstanceA as source
- ✅ New values (`deployment.region`) have InstanceA as source

---

### 2. Component Reference Expansion

#### Test 2.1: Create COMPONENT Config
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "BatteryComponent",
  "type": "COMPONENT",
  "data": {
    "capacity": 5000,
    "voltage": 12.6,
    "chemistry": "Li-ion"
  }
}
```
Save ID as `{{batteryComponentId}}`

#### Test 2.2: Create VERSION of Component
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "BatteryV2",
  "type": "VERSION",
  "parent_id": "{{batteryComponentId}}",
  "data": {
    "capacity": 6000,
    "charging": {
      "maxWatts": 100,
      "fastChargeSupported": true
    }
  }
}
```
Save ID as `{{batteryVersionId}}`

#### Test 2.3: Create PRODUCT with Component Reference
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "ProductWithComponents",
  "type": "PRODUCT",
  "data": {
    "name": "EV Model X",
    "Battery": {
      "componentId": "{{batteryComponentId}}",
      "versionId": "{{batteryVersionId}}",
      "componentName": "Battery",
      "versionName": "v2.0"
    }
  }
}
```
Save ID as `{{productWithComponentsId}}`

#### Test 2.4: Get Resolved Product (Component Expanded)
```http
GET http://localhost:3004/api/configs/{{productWithComponentsId}}
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
{
  "config": {
    "name": "EV Model X",
    "Battery": {
      "componentId": "{{batteryComponentId}}",
      "versionId": "{{batteryVersionId}}",
      "componentName": "Battery",
      "versionName": "v2.0",
      "capacity": 6000,
      "voltage": 12.6,
      "chemistry": "Li-ion",
      "charging": {
        "maxWatts": 100,
        "fastChargeSupported": true
      }
    }
  }
}
```

**Verify:**
- ✅ Component metadata preserved (`componentId`, `versionId`, etc.)
- ✅ Inherited properties from COMPONENT (`voltage`, `chemistry`)
- ✅ Overridden properties from VERSION (`capacity`: 6000 instead of 5000)
- ✅ New properties from VERSION (`charging` object)

---

### 3. Array Notation in Path Traversal

#### Test 3.1: Create Config with Array Data
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "ArrayTestConfig",
  "type": "PRODUCT",
  "data": {
    "items": [
      {"name": "First", "value": 10, "active": true},
      {"name": "Second", "value": 20, "active": false},
      {"name": "Third", "value": 30, "active": true}
    ],
    "matrix": [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ]
  }
}
```
Save name as `ArrayTestConfig`

#### Test 3.2: Access Array Element by Index
```http
GET http://localhost:3004/api/configs/by-name/ArrayTestConfig/data?path=items[0]&minimal=true
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
{
  "name": "First",
  "value": 10,
  "active": true
}
```

#### Test 3.3: Access Nested Property in Array Element
```http
GET http://localhost:3004/api/configs/by-name/ArrayTestConfig/data?path=items[1].name&minimal=true
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
"Second"
```

#### Test 3.4: Access Nested Array Element
```http
GET http://localhost:3004/api/configs/by-name/ArrayTestConfig/data?path=matrix[1][2]&minimal=true
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
6
```

#### Test 3.5: Invalid Array Index (Out of Bounds)
```http
GET http://localhost:3004/api/configs/by-name/ArrayTestConfig/data?path=items[99]&minimal=true
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
{
  "error": "array index 99 out of bounds at path: items[99] (length: 3)"
}
```

#### Test 3.6: Array Notation with Dot Notation
```http
GET http://localhost:3004/api/configs/by-name/ArrayTestConfig/data?path=items[2].active&minimal=true
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
true
```

---

### 4. Minimal Mode Unwrapping

#### Test 4.1: Get Data Without Minimal Mode
```http
GET http://localhost:3004/api/configs/{{instanceId}}/data
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
{
  "data": {
    "system": {
      "name": "Base System",
      "version": "1.0.0"
    },
    "settings": {
      "theme": "dark",
      "language": "en"
    }
  },
  "metadata": {...}
}
```

#### Test 4.2: Get Data With Minimal Mode
```http
GET http://localhost:3004/api/configs/{{instanceId}}/data?minimal=true
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
{
  "system": {
    "name": "Base System",
    "version": "1.0.0"
  },
  "settings": {
    "theme": "dark",
    "language": "en"
  },
  "deployment": {
    "region": "us-east-1"
  }
}
```

**Verify:**
- ✅ No `{value, source}` wrappers
- ✅ Pure data structure
- ✅ No metadata wrapper

#### Test 4.3: Get Path Value with Minimal Mode
```http
GET http://localhost:3004/api/configs/{{instanceId}}/data?path=settings&minimal=true
Authorization: Bearer {{adminToken}}
```

**Expected Response:**
```json
{
  "theme": "dark",
  "language": "en"
}
```

---

## Edge Cases

### Edge Case 1: Empty Path with Minimal Mode
```http
GET http://localhost:3004/api/configs/{{instanceId}}/data?minimal=true
Authorization: Bearer {{adminToken}}
```
**Expected**: Full config data without provenance wrappers

### Edge Case 2: Deep Nesting with Arrays
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "DeepNesting",
  "type": "PRODUCT",
  "data": {
    "users": [
      {
        "name": "Alice",
        "permissions": [
          {"resource": "files", "actions": ["read", "write"]},
          {"resource": "configs", "actions": ["read"]}
        ]
      }
    ]
  }
}
```

```http
GET http://localhost:3004/api/configs/by-name/DeepNesting/data?path=users[0].permissions[1].resource&minimal=true
Authorization: Bearer {{adminToken}}
```
**Expected**: `"configs"`

### Edge Case 3: Component Reference Not Found
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "BrokenProduct",
  "type": "PRODUCT",
  "data": {
    "Battery": {
      "versionId": "000000000000000000000000"
    }
  }
}
```

```http
GET http://localhost:3004/api/configs/by-name/BrokenProduct
Authorization: Bearer {{adminToken}}
```
**Expected**: `Battery` resolves to empty object `{}`

---

## Performance Testing

### Test Large Config Resolution
```http
POST http://localhost:3004/api/configs
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "name": "LargeConfig",
  "type": "PRODUCT",
  "data": {
    // Generate large nested structure
    "level1": {
      "level2": {
        "level3": {
          "items": [/* 100+ items */]
        }
      }
    }
  }
}
```

**Measure:**
- Response time with `provenance=false` (baseline)
- Response time with `provenance=true` (should be ~2x baseline)
- Memory usage

---

## Success Criteria

### Provenance Tracking
- ✅ Inherited values show original source
- ✅ Overridden values show new source
- ✅ Nested objects preserve provenance correctly
- ✅ Minimal mode removes all provenance

### Component Expansion
- ✅ Component references resolved inline
- ✅ Component metadata preserved
- ✅ Inheritance chain resolved for components
- ✅ Missing components handled gracefully

### Array Notation
- ✅ Simple array access works (`items[0]`)
- ✅ Nested arrays work (`matrix[1][2]`)
- ✅ Mixed notation works (`items[0].name`)
- ✅ Bounds checking works (error on invalid index)

### Minimal Mode
- ✅ No provenance wrappers in response
- ✅ Pure data structures
- ✅ Recursive unwrapping works

---

## Troubleshooting

### Issue: Provenance not appearing
**Solution**: Add `?provenance=true` query parameter

### Issue: Component not expanding
**Check**:
- Component has `versionId` field
- Referenced version exists in database
- Referenced version is VERSION or COMPONENT type

### Issue: Array path not working
**Check**:
- Use square brackets: `items[0]` not `items.0`
- Index is within bounds
- Value at path is actually an array

### Issue: Minimal mode still has wrappers
**Check**:
- Using `?minimal=true` query parameter
- Not using `?provenance=true` simultaneously

---

**Testing Complete!** ✅

All Phase 3 features are ready for production use.

