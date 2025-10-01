# API Endpoints Summary

This document provides a comprehensive list of all available API endpoints in the DMoney Transaction API.

## User Management Endpoints

### Authentication
- **POST** `/user/login` - Login and get JWT token
  - No authentication required
  - Request body: `{ email, password }`

### User Operations (Require Authentication)

#### List & Search
- **GET** `/user/list` - Get list of all users with balances
  - Security: JWT (publicAuthenticateJWT)
  
- **GET** `/user/search/id/:id` - Search user by ID
  - Security: JWT (publicAuthenticateJWT)
  
- **GET** `/user/search/phonenumber/:phone_number` - Search user by phone number
  - Security: JWT (publicAuthenticateJWT)
  
- **GET** `/user/search/email/:email` - Search user by email
  - Security: JWT (publicAuthenticateJWT)
  
- **GET** `/user/search/:role` - Search users by role
  - Security: JWT (authenticateJWT)

#### User CRUD Operations
- **POST** `/user/create` - Create a new user
  - Security: JWT (authenticateJWT) + X-AUTH-SECRET-KEY header
  - Only Admin can create users
  
- **PUT** `/user/update/:id` - Full update user by ID
  - Security: JWT (authenticateJWT)
  - Only Admin can update users
  
- **PATCH** `/user/update/:id` - Partial update user by ID
  - Security: JWT (authenticateJWT)
  - Only Admin can update users
  
- **DELETE** `/user/delete/:id` - Delete user by ID
  - Security: JWT (authenticateJWT)
  - Only Admin can delete users
  - Cannot delete SYSTEM user

#### File Upload
- **POST** `/user/upload/:id` - Upload photo for a user
  - Security: JWT (authenticateJWT)
  - Content-Type: multipart/form-data
  
- **GET** `/user/uploads/:file` - Retrieve uploaded user photo
  - No authentication required
  - Returns image file

---

## Transaction Endpoints

All transaction endpoints require JWT authentication.

### Transaction Information
- **GET** `/transaction/list` - Get list of all transactions
  - Security: JWT (authenticateJWT)
  
- **GET** `/transaction/search/:trnxId` - Search transaction by transaction ID
  - Security: JWT (authenticateJWT)
  
- **GET** `/transaction/statement/:account` - Get transaction statement by account
  - Security: JWT (authenticateJWT)
  
- **GET** `/transaction/limit/:account` - Get user transaction limit by account
  - Security: JWT (authenticateJWT)
  
- **GET** `/transaction/balance/:account` - Get user balance by account
  - Security: JWT (authenticateJWT)

### Transaction Operations

#### Deposit
- **POST** `/transaction/deposit` - Deposit money to an account
  - Security: JWT (authenticateJWT)
  - Only Agent can deposit
  - Request body: `{ from_account, to_account, amount }`
  - Amount range: 10-10000 tk
  - Includes commission calculation

#### Withdraw
- **POST** `/transaction/withdraw` - Withdraw money from customer account via agent
  - Security: JWT (authenticateJWT)
  - Customer withdraws through Agent
  - Request body: `{ from_account, to_account, amount }`
  - Minimum amount: 10 tk
  - Includes withdrawal fee

#### Send Money
- **POST** `/transaction/sendmoney` - Send money between customer accounts
  - Security: JWT (authenticateJWT)
  - Only Customer can send money
  - Request body: `{ from_account, to_account, amount }`
  - Minimum amount: 10 tk
  - Includes P2P transfer fee

#### Payment
- **POST** `/transaction/payment` - Process payment transaction
  - Security: JWT (authenticateJWT)
  - Customer/Agent can pay to Merchant
  - Request body: `{ from_account, to_account, amount }`
  - Minimum amount: 10 tk
  - Includes payment fee

---

## Server Status
- **GET** `/` - Check server status
  - No authentication required
  - Returns: `{ message: "Server is up" }`

---

## Security Schemes

### JWT Bearer Authentication
- Type: HTTP Bearer
- Format: JWT
- Header: `Authorization: Bearer <token>`

### X-AUTH-SECRET-KEY
- Type: API Key
- Location: Header
- Header name: `X-AUTH-SECRET-KEY`
- Used for: User creation endpoint

---

## User Roles
- **Admin** - Full access to user management
- **Customer** - Can perform transactions (send money, payment, withdraw)
- **Agent** - Can deposit and withdraw
- **Merchant** - Can receive payments
- **SYSTEM** - System user (cannot be deleted)

---

## Response Status Codes

### Success
- **200** - OK
- **201** - Created

### Client Errors
- **400** - Bad Request (validation error)
- **401** - Unauthorized (incorrect credentials)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found

### Special
- **208** - Already Reported (used for transaction failures like insufficient balance)

### Server Error
- **500** - Internal Server Error

---

## Documentation Files
- **swaggerUser.yaml** - Complete user management API documentation
- **swaggerTrnx.yaml** - Complete transaction API documentation

## Swagger UI Access
Access the interactive API documentation at:
- User API: `/api-docs/user`
- Transaction API: `/api-docs/transaction`
