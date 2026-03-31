# Secure-project-management-API

A secure and scalable REST API for managing projects and tasks with authentication, authorization, and role-based access control.

This project is built using **Node.js, Express, and MySQL**, implementing industry-level security practices like JWT authentication, refresh tokens, and role-based permissions.

---

## 📌 Features

### 🔐 Authentication System

* User Registration & Login
* Password hashing using bcrypt
* JWT-based authentication
* Access Token (15 min expiry)
* Refresh Token (7 days expiry)
* Logout with token invalidation

---

### 🔁 Token Management

* Secure JWT implementation
* Refresh token stored in database
* Token rotation (old token invalidated on refresh)

---

### 👥 Role-Based Authorization

| Role    | Permissions                           |
| ------- | ------------------------------------- |
| Admin   | Full control (users, projects, tasks) |
| Manager | Create projects, assign tasks         |
| User    | View & update assigned tasks          |

---

### 📁 Project Management

* Create Project
* Get All Projects
* Get Project by ID
* Delete Project

**Rules:**

* Only Admin/Manager → Create
* Only Admin → Delete

---

### ✅ Task Management

* Create Task
* Get Tasks
* Get Task by ID
* Update Task Status
* Delete Task

**Rules:**

* Manager assigns tasks
* Users see only their tasks
* Users update only their task status
* Admin can delete any task

---

### 🛡️ Security Features

* Password hashing (bcrypt)
* JWT verification
* Refresh token rotation
* SQL Injection protection
* Input validation
* Rate limiting (login protection)
* Soft delete users

---

### 📄 Pagination

* Implemented in:

  * GET /tasks
  * GET /projects

---

## 🧱 Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** MySQL
* **Authentication:** JWT
* **Security:** bcrypt, rate limiting

---

## 📂 Project Structure

```
src/
│
├── controllers/
├── routes/
├── middleware/
├── models/
├── config/
├── utils/
└── index.js
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

### 2️⃣ Install Dependencies

```bash
npm install express bcrypt nodemon jsonwebtoken mysql2 yup dotenv
```

### 3️⃣ Setup Environment Variables

Create `.env` file:

```
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=project_management

JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

---

### 4️⃣ Run Server

```bash
npm run dev
```

---

## 🔌 API Endpoints

### 🔐 Auth Routes

```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

---

### 📁 Project Routes

```
POST   /projects
GET    /projects
GET    /projects/:id
DELETE /projects/:id
```

---

### ✅ Task Routes

```
POST   /tasks
GET    /tasks
GET    /tasks/:id
PATCH  /tasks/:id/status
DELETE /tasks/:id
```

---

## 🔑 Middleware

### authenticateToken

* Verifies JWT
* Attaches user to request

### authorizeRoles(...roles)

* Restricts route access based on roles

---

## 🧠 How It Works

1. User registers → password hashed using bcrypt
2. User logs in → gets access + refresh token
3. Access token used for protected routes
4. Refresh token used to generate new access token
5. Role middleware controls access
6. Database stores users, projects, tasks, and tokens
7. Security layers prevent unauthorized access

---

## 📊 Database Tables

### Users

* id, name, email, password_hash, role, created_at

### Projects

* id, name, description, created_by, created_at

### Tasks

* id, title, description, project_id, assigned_to, status

### Refresh Tokens

* id, user_id, token, expires_at

---

## 🚀 Future Improvements

* Swagger API docs
* Testing (Jest)
* Docker support
* CI/CD pipeline
* Redis caching

---

## 👩‍💻 Author

Alisha Jahan

---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub!
