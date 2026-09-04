# The Way

A full-stack church service platform built for **The Way Service at Saint George Church**. The application centralizes service resources and church activities in one authenticated platform, including lessons, games, activities, chants, trips/camps, user profiles, email verification, role-based management, and an administrative dashboard.

Repository: https://github.com/Pascalion-EX/The_Way

---

## Table of Contents

- [Overview](#overview)
- [Main Features](#main-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Roles and Permissions](#roles-and-permissions)
- [Frontend Routes](#frontend-routes)
- [Backend API](#backend-api)
- [Data Models](#data-models)
- [Authentication Flow](#authentication-flow)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Production Deployment](#production-deployment)
- [Project Structure](#project-structure)
- [Security Notes](#security-notes)
- [Current Implementation Notes](#current-implementation-notes)
- [Recommended Next Steps](#recommended-next-steps)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**The Way** is a MERN-style web application designed to support a church service team and its members.

The system provides a common place for:

- Church lessons and educational material
- Service games and activities
- Church chants in multiple languages
- Trips, camps, outings, and participant applications
- User profiles and role-based access
- Email verification and password recovery
- Administrative user management

The project is divided into two applications:

- `frontend/` — React + Vite client
- `backend/` — Express + MongoDB API

The frontend communicates with the backend through REST endpoints and uses an HTTP-only JWT cookie for authentication.

---

## Main Features

### Authentication and Accounts

- User registration
- User login
- User logout
- JWT authentication stored in an HTTP-only cookie
- Protected frontend routes
- Email verification using a one-time password (OTP)
- Password reset using an emailed OTP
- User profile viewing and editing
- Role-based authorization

### Lessons

- View all lessons
- Search by title, name, or lesson body
- Filter by school/service year
- View individual lesson pages
- Create lessons
- Edit lessons
- Delete lessons
- Optional video and activity fields
- Creator information stored with each lesson

### Games

- View service games
- View detailed game instructions
- Store required materials
- Store explanations/how-to-play instructions
- Optional video support
- Image support
- Create, update, and delete games for authorized roles
- Export a game as a PDF from the game viewer

### Activities

- Store service activities separately from games
- Materials list
- Activity explanation
- Image support
- Optional video support
- Create, read, update, and delete API operations

### Chants

- Store church chants by title and category
- Supported categories:
  - Praise
  - Worship
  - Kids
  - Mass
  - Tasbeha
  - Other
- Multilingual lyrics:
  - Arabic
  - Coptic
  - English
- Search chants by title
- Filter by category
- Favorite/unfavorite chants
- Filter to favorite chants only
- Audio link support
- Video/embed support
- Lyrics split into presentation slides using blank lines
- Previous/next slide navigation
- Keyboard arrow navigation
- Full-screen mode
- Projector mode
- Export selected chant language to PDF
- Authorized create, edit, and delete operations

### Trips and Camps

The trip system supports the following trip types:

- Camp
- Trip
- Outing
- Other

Features include:

- Create trips/camps
- List all trips/camps
- View details
- Update trips/camps through the API
- Delete trips/camps
- Assign one or more eligible years/classes
- Search by title, organizer/name, body, type, or year on the frontend
- Filter by year
- Sort by year ascending or descending
- Apply for a trip
- Withdraw an application
- Role-specific application forms
- Notify trip applicants by email

Application types currently used by the controller are:

- `parent_for_child`
- `child_self`
- `leader`

### Admin Dashboard

Authorized administrators can:

- View total user count
- View total lesson count from the API
- View counts by role
- View registered users
- See account verification status
- See user class/year information
- Delete users
- Prevent self-deletion at the backend level

---

## Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 19 | User interface |
| Vite 7 | Development server and frontend build tool |
| React Router DOM | Client-side routing |
| Tailwind CSS 4 | Styling |
| Axios | HTTP/API communication |
| React Toastify | Notifications |
| Lucide React | Icons |
| Radix UI / shadcn dependencies | UI building blocks |
| jsPDF | Client-side PDF generation |
| html2pdf.js | HTML/PDF generation support |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express 5 | REST API server |
| MongoDB | Database |
| Mongoose 9 | MongoDB ODM |
| bcryptjs | Password hashing |
| jsonwebtoken | JWT creation and validation |
| cookie-parser | Reading authentication cookies |
| CORS | Cross-origin request configuration |
| Nodemailer | Email/OTP delivery |
| dotenv | Environment configuration |
| Nodemon | Development server restart |

---

## Architecture

```text
Browser
   |
   | HTTPS / REST requests
   v
React + Vite Frontend
   |
   | Axios with credentials
   v
Express REST API
   |
   +--> JWT Cookie Authentication
   |
   +--> Controllers
   |      |
   |      +--> Role checks
   |      +--> Business logic
   |      +--> Nodemailer
   |
   v
Mongoose
   |
   v
MongoDB
```

### Authentication Architecture

The application uses a cookie named `token`.

The backend signs a JWT containing the user's MongoDB ID:

```text
JWT payload
└── id: <MongoDB user id>
```

The `userAuth` middleware:

1. Reads `req.cookies.token`.
2. Verifies it with `JWT_SECRET`.
3. Extracts the user ID.
4. Stores the ID in `req.userId`.
5. Continues to the protected controller.

The JWT currently expires after **2 days**.

---

## Roles and Permissions

The user schema currently supports these role values:

```text
pascal
admin
leader
parent
child
pamela
unAssined
```

A user can hold multiple roles because `role` is stored as an array.

### Intended Backend Permissions

| Feature | Roles |
|---|---|
| View authenticated content | Any logged-in user |
| Admin dashboard | `admin`, `pamela`, `pascal` |
| Delete users | `admin`, `pamela`, `pascal` |
| Manage lessons | `pascal`, `admin`, `leader`, `pamela` |
| Manage games | `admin`, `leader`, `pascal`, `pamela` |
| Manage chants | `admin`, `leader`, `pascal`, `pamela` |
| Manage activities | `admin`, `leader`, `pascal`, `pamela` intended |
| Create/manage trips | `admin`, `leader`, `pascal`, `pamela` intended by backend |
| Apply to trips | `parent`, `child`, `admin`, `leader`, `pascal` |
| Notify trip applicants | `admin`, `leader`, `pascal` |

> See [Current Implementation Notes](#current-implementation-notes) for permission inconsistencies currently present between some frontend and backend checks.

---

## Frontend Routes

### Public Routes

| Route | Page | Description |
|---|---|---|
| `/login` | `Login.jsx` | Login and registration |
| `/email-verify` | `EmailVerify.jsx` | Verify account using OTP |
| `/reset-password` | `ResetPassword.jsx` | Password reset flow |

### Protected Routes

All routes below are wrapped in `ProtectedRoute` and require a valid authentication cookie.

| Route | Page | Description |
|---|---|---|
| `/` | `Home.jsx` | Main home page |
| `/info` | `Info.jsx` | Service information |
| `/profile` | `Profile.jsx` | User profile |
| `/admin` | `Admin.jsx` | Admin dashboard |
| `/lessons` | `Lessons.jsx` | Lessons list/search |
| `/lessons/:id` | `LessonViewer.jsx` | Lesson details |
| `/lessons/:id/edit` | `EditLesson.jsx` | Edit lesson |
| `/create-lesson` | `CreateLesson.jsx` | Create lesson |
| `/camps` | `Camps.jsx` | Trips and camps |
| `/camps/:id` | `CampDetails.jsx` | Trip/camp details |
| `/create-camp` | `Createcamp.jsx` | Create trip/camp |
| `/games` | `Games.jsx` | Games list |
| `/games/view` | `GamesViewer.jsx` | Game viewer |
| `/create-game` | `Creategame.jsx` | Create game |
| `/activities` | `Activities.jsx` | Activities list |
| `/chants` | `Chants.jsx` | Chants list/search |
| `/chants/:id` | `ChantViewer.jsx` | Chant viewer/presenter |
| `/create-chant` | `CreateChant.jsx` | Create chant |
| `/edit-chant/:id` | `EditChant.jsx` | Edit chant |

Unknown frontend routes are redirected to `/`.

---

## Backend API

Default development backend URL:

```text
http://localhost:4000
```

Most non-authentication endpoints use the `userAuth` middleware and require the JWT cookie.

### Health Check

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| GET | `/` | No | Confirms that the API is running |

### Authentication API

Base path: `/api/auth`

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| POST | `/register` | No | Create account and issue JWT cookie |
| POST | `/login` | No | Authenticate user and issue JWT cookie |
| GET | `/check-auth` | Yes | Confirm authenticated user ID |
| POST | `/logout` | No middleware | Clear authentication cookie |
| POST | `/send-verify-otp` | Yes | Email account verification OTP |
| POST | `/verify-account` | Yes | Verify account OTP |
| GET | `/is-auth` | Yes | Check if current cookie is valid |
| POST | `/send-reset-otp` | No | Email password reset OTP |
| POST | `/reset-password` | No | Reset password using OTP |

#### Register Body

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "password"
}
```

#### Login Body

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

#### Verify Account Body

```json
{
  "otp": "123456"
}
```

#### Reset Password Body

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "new-password"
}
```

### User API

Base path: `/api/user`

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| GET | `/data` | Yes | Return current user's profile data |
| PUT | `/update-profile` | Yes | Update profile fields |

Supported profile update fields currently include:

```json
{
  "name": "Name",
  "email": "email@example.com",
  "phone": "01234567890",
  "class": 5
}
```

### Admin API

Base path: `/api/admin`

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| GET | `/dashboard` | Yes + admin-role check | User list and statistics |
| DELETE | `/users/:id` | Yes + admin-role check | Delete a user |

### Lessons API

Base path: `/api/lessons`

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| GET | `/` | Yes | List lessons |
| GET | `/:lessonId` | Yes | Get lesson by ID |
| POST | `/` | Yes + role check | Create lesson |
| PUT | `/:lessonid` | Yes + role check | Update lesson |
| DELETE | `/:lessonId` | Yes + role check | Delete lesson |

Supported GET query parameters:

```text
search=<text>
year=<number>
```

Lesson create/update payload:

```json
{
  "title": "Lesson Title",
  "name": "Lesson Name",
  "body": "Lesson content",
  "image": "https://example.com/image.jpg",
  "year": 5,
  "video": "https://example.com/video",
  "activity": "Optional activity text"
}
```

### Camps and Trips API

Base path: `/api/camps`

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| POST | `/` | Yes + role check | Create trip/camp |
| GET | `/` | Yes | List trips/camps |
| GET | `/:id` | Yes | Get trip/camp by ID |
| PUT | `/:id` | Yes + role check | Update trip/camp |
| DELETE | `/:id` | Yes + role check | Delete trip/camp |
| POST | `/:id/apply` | Yes + role check | Apply to trip/camp |
| DELETE | `/:id/apply` | Yes | Withdraw application |
| POST | `/:id/notify` | Yes + role check | Email applicants |

Typical trip/camp data:

```json
{
  "title": "Summer Camp",
  "name": "Service Team",
  "body": "Camp description",
  "TripType": "Camp",
  "image": "https://example.com/image.jpg",
  "years": [4, 5, 6]
}
```

Application payloads vary by application type.

Parent applying for a child:

```json
{
  "applicationType": "parent_for_child",
  "childName": "Child Name",
  "childYear": 5,
  "parentPhone": "01234567890",
  "notes": "Optional notes"
}
```

Child applying for themselves:

```json
{
  "applicationType": "child_self",
  "childName": "Child Name",
  "childYear": 5,
  "parentPhone": "01234567890",
  "notes": "Optional notes"
}
```

Leader application:

```json
{
  "applicationType": "leader",
  "leaderName": "Leader Name",
  "leaderRole": "Service Role",
  "parentPhone": "01234567890",
  "notes": "Optional notes"
}
```

Applicant notification payload:

```json
{
  "subject": "Trip Update",
  "message": "Message sent to applicants"
}
```

### Games API

Base path: `/api/games`

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| POST | `/create` | Yes + role check | Create game |
| GET | `/` | Yes | List games |
| GET | `/:id` | Yes | Get game by ID |
| PUT | `/:id` | Yes + role check | Update game |
| DELETE | `/:id` | Yes + role check | Delete game |

Game payload:

```json
{
  "name": "Game Name",
  "materials": "Required materials",
  "explanation": "How the game works",
  "image": "https://example.com/image.jpg",
  "video": "https://example.com/video"
}
```

### Chants API

Base path: `/api/chants`

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| GET | `/` | Yes | List/search chants |
| GET | `/:id` | Yes | Get chant by ID |
| POST | `/create` | Yes + role check | Create chant |
| PUT | `/:id` | Yes + role check | Update chant |
| DELETE | `/:id` | Yes + role check | Delete chant |
| PATCH | `/:id/favorite` | Yes | Toggle current user's favorite |

Supported GET query parameters used by the frontend:

```text
search=<title text>
category=<Praise|Worship|Kids|Mass|Tasbeha|Other>
favoriteOnly=true
```

Chant payload:

```json
{
  "title": "Chant Title",
  "category": "Praise",
  "image": "https://example.com/image.jpg",
  "audio": "https://example.com/audio",
  "video": "https://example.com/video",
  "lyrics": {
    "arabic": "Arabic lyrics",
    "coptic": "Coptic lyrics",
    "english": "English lyrics"
  }
}
```

At least one lyrics language is required by the controller.

### Activities API

Base path: `/api/activities`

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| POST | `/` | Yes + intended role check | Create activity |
| GET | `/` | Yes | List activities |
| GET | `/:id` | Yes | Get activity by ID |
| PUT | `/:id` | Yes + intended role check | Update activity |
| DELETE | `/:id` | Yes + intended role check | Delete activity |

Activity payload:

```json
{
  "name": "Activity Name",
  "materials": "Required materials",
  "explanation": "Activity instructions",
  "image": "https://example.com/image.jpg",
  "video": "https://example.com/video"
}
```

---

## Data Models

### User

```text
name                 String, required
email                String, required, unique
password             String, required, hashed before storage by controller
verifyOtp             String
verifyOtpExpireAt     Number
isAccountVerified     Boolean
resetOtp              String
resetOtpExpireAt      Number
class                 Number
phone                 String
role                  String[]
```

Default role:

```text
unAssined
```

### Lesson

```text
title       String, required
name        String, required
body        String, required
image       String, required
video       String, optional
activity    String, optional
year        Number, required
createdBy   ObjectId -> user
createdAt   Date
updatedAt   Date
```

### Camp / Trip

Core fields:

```text
title       String, required
name        String, required
body        String, required
TripType    Camp | Trip | Outing | Other
image       String
years       Number[]
createdBy   ObjectId -> user
applicants  Array
createdAt   Date
updatedAt   Date
```

The controller currently works with richer applicant fields including:

```text
user
applicationType
childName
childYear
parentPhone
leaderName
leaderRole
notes
appliedAt
```

See the schema warning in [Current Implementation Notes](#current-implementation-notes).

### Game

```text
name          String, required
materials     String, required
explanation   String, required
image         String, required
video         String, optional
createdBy     ObjectId -> user
createdAt     Date
updatedAt     Date
```

### Chant

```text
title               String, required
category            Praise | Worship | Kids | Mass | Tasbeha | Other
image               String
audio               String
video               String
lyrics.arabic       String
lyrics.coptic       String
lyrics.english      String
favorites           ObjectId[] -> user
createdBy           ObjectId -> user
createdAt           Date
updatedAt           Date
```

### Activity

```text
name          String, required
materials     String, required
explanation   String, required
image         String, required
video         String, optional
createdBy     ObjectId -> user
createdAt     Date
updatedAt     Date
```

---

## Authentication Flow

### Registration

```text
User submits name/email/password
        |
        v
Backend checks existing email
        |
        v
Password hashed with bcrypt
        |
        v
User saved in MongoDB
        |
        v
JWT generated
        |
        v
HTTP-only cookie returned
        |
        v
Welcome email sent
```

### Login

```text
Email/password submitted
        |
        v
Email normalized and validated
        |
        v
User loaded from MongoDB
        |
        v
bcrypt compares password hash
        |
        v
JWT generated for 2 days
        |
        v
HTTP-only token cookie returned
```

### Email Verification

```text
Authenticated user requests OTP
        |
        v
6-digit OTP generated
        |
        v
OTP + expiration saved to user
        |
        v
OTP emailed through Nodemailer
        |
        v
User submits OTP
        |
        v
Account marked verified
```

Verification OTP expiration is currently configured for **12 hours**.

### Password Reset

```text
User submits email
        |
        v
Reset OTP generated and emailed
        |
        v
User submits email + OTP + new password
        |
        v
OTP validated
        |
        v
New password hashed and stored
```

Reset OTP expiration is currently configured for **12 hours**.

---

## Environment Variables

Never commit real credentials to Git.

### Backend

Create:

```text
backend/.env
```

Example:

```env
PORT=4000
NODE_ENV=development

MONGODB_URL=mongodb+srv://USERNAME:PASSWORD@HOST
JWT_SECRET=replace-with-a-long-random-secret

SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password-or-app-password
SENDER_EMAIL=your-sender-email@example.com
```

The database configuration appends the database name to `MONGODB_URL`:

```js
mongoose.connect(`${process.env.MONGODB_URL}/The way`)
```

Make sure your MongoDB connection string is compatible with that format.

The current mail transport uses Gmail SMTP on port `465`.

### Frontend

Create:

```text
frontend/.env
```

Example:

```env
VITE_BACKEND_URL=http://localhost:4000
```

For production, set this to the public HTTPS URL of the backend API.

---

## Installation

### Prerequisites

Install:

- Node.js 20+ recommended
- npm
- MongoDB or MongoDB Atlas
- An SMTP/Gmail account for verification and reset emails

### 1. Clone the Repository

```bash
git clone https://github.com/Pascalion-EX/The_Way.git
cd The_Way
```

### 2. Install Root Dependencies

```bash
npm install
```

The root currently contains PDF-related dependencies used by frontend source files.

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 5. Configure Environment Variables

Create:

```text
backend/.env
frontend/.env
```

Use the variables shown in the [Environment Variables](#environment-variables) section.

---

## Running the Project

The most reliable current development method is to run frontend and backend separately.

### Terminal 1 — Backend

```bash
cd backend
npm run server
```

Backend:

```text
http://localhost:4000
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Frontend normally starts at:

```text
http://localhost:5173
```

### Root Development Script

The root package defines:

```bash
npm run dev
```

which is intended to run both applications with `concurrently`.

However, `concurrently` is currently not declared in the root `package.json`. Either continue using two terminals or add it to the root development dependencies:

```bash
npm install --save-dev concurrently
```

Then:

```bash
npm run dev
```

---

## Production Deployment

A typical production architecture is:

```text
Internet
   |
   v
Nginx / Reverse Proxy
   |
   +--> Frontend static build
   |
   +--> /api -> Node/Express backend
                 |
                 v
              MongoDB
```

### Frontend Build

```bash
cd frontend
npm run build
```

Vite creates:

```text
frontend/dist/
```

Serve this directory with Nginx, a static host, or another production web server.

### Backend Start

```bash
cd backend
npm start
```

For a VPS, use a process manager such as PM2 or a systemd service so the backend restarts after failures or reboots.

### Required Production Changes

Before deployment:

1. Set `NODE_ENV=production`.
2. Use HTTPS.
3. Set `VITE_BACKEND_URL` to the production API URL.
4. Replace the hard-coded development CORS origin.
5. Allow only trusted production frontend origins.
6. Store secrets outside the repository.
7. Configure MongoDB network access securely.
8. Configure a production SMTP sender.
9. Put the Node process behind Nginx or another reverse proxy.
10. Add database and file backup procedures.

Because production cookies use:

```text
secure: true
sameSite: none
```

HTTPS is required for normal production authentication behavior.

---

## Project Structure

```text
The_Way/
├── README.md
├── package.json
├── package-lock.json
│
├── backend/
│   ├── config/
│   │   ├── mongodb.js
│   │   └── nodemailer.js
│   │
│   ├── controllers/
│   │   ├── activitiesController.js
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── campController.js
│   │   ├── chantController.js
│   │   ├── gameController.js
│   │   ├── lessonController.js
│   │   └── userController.js
│   │
│   ├── middleware/
│   │   └── userAuth.js
│   │
│   ├── models/
│   │   ├── activitiesModel.js
│   │   ├── campsModel.js
│   │   ├── chantModel.js
│   │   ├── gamesModel.js
│   │   ├── lessonModel.js
│   │   └── userModel.js
│   │
│   ├── routes/
│   │   ├── activitiesRoutes.js
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── campRoutes.js
│   │   ├── chantRoutes.js
│   │   ├── gameRoutes.js
│   │   ├── lessonRoutes.js
│   │   └── userRoutes.js
│   │
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── Components/
    │   │   ├── Header.jsx
    │   │   ├── Navbar.jsx
    │   │   ├── ProtectedRoute.jsx
    │   │   ├── Waves.jsx
    │   │   ├── chantCard.jsx
    │   │   └── cusbutton.jsx
    │   │
    │   ├── Context/
    │   │   └── AppContext.jsx
    │   │
    │   ├── Pages/
    │   │   ├── Activities.jsx
    │   │   ├── Admin.jsx
    │   │   ├── CampDetails.jsx
    │   │   ├── Camps.jsx
    │   │   ├── ChantViewer.jsx
    │   │   ├── Chants.jsx
    │   │   ├── CreateChant.jsx
    │   │   ├── CreateLesson.jsx
    │   │   ├── Createcamp.jsx
    │   │   ├── Creategame.jsx
    │   │   ├── EditChant.jsx
    │   │   ├── EditLesson.jsx
    │   │   ├── EmailVerify.jsx
    │   │   ├── Games.jsx
    │   │   ├── GamesViewer.jsx
    │   │   ├── Home.jsx
    │   │   ├── Info.jsx
    │   │   ├── LessonViewer.jsx
    │   │   ├── Lessons.jsx
    │   │   ├── Login.jsx
    │   │   ├── Profile.jsx
    │   │   └── ResetPassword.jsx
    │   │
    │   ├── assets/
    │   ├── components/ui/
    │   ├── lib/
    │   ├── utils/
    │   │   └── axios.js
    │   ├── App.jsx
    │   ├── index.css
    │   └── main.jsx
    │
    ├── package.json
    └── vite.config.js
```

---

## Security Notes

### Existing Security Measures

The current project already includes several useful security practices:

- Password hashing with bcrypt
- HTTP-only authentication cookies
- JWT expiration
- Secure cookies in production
- Authentication middleware
- Server-side role checks for major protected operations
- Generic invalid-login response to reduce account enumeration during login
- Mongoose `sanitizeFilter` / `strictQuery` usage in parts of the backend
- Sensitive user fields excluded from admin dashboard queries

### Important Repository Security Issue

At the time this documentation was generated, the repository tree contains tracked `.env` files and tracked `node_modules` directories.

These should not be committed.

Recommended `.gitignore` entries:

```gitignore
# dependencies
node_modules/
backend/node_modules/
frontend/node_modules/

# environment variables
.env
.env.*
backend/.env
frontend/.env

# frontend build
frontend/dist/

# logs
*.log
npm-debug.log*
```

If any real database password, JWT secret, SMTP password, API key, or other credential has ever been committed to Git, assume that credential is exposed and **rotate it immediately**. Removing the file from the latest commit is not enough because old commits may still contain it.

### Additional Production Security Recommendations

- Add rate limiting to login, registration, OTP, and password-reset endpoints.
- Add request validation with a schema validator such as Zod, Joi, or express-validator.
- Add request body size limits.
- Add Helmet security headers.
- Add CSRF protection or an equivalent strategy when using cross-site cookies.
- Keep CORS origins in environment configuration.
- Do not expose MongoDB directly to the public internet unless explicitly required and secured.
- Use a strong random `JWT_SECRET`.
- Use a Gmail App Password or dedicated SMTP provider rather than an account password.
- Add centralized error handling instead of returning raw database error messages in production.
- Add audit logging for destructive admin actions.
- Add automated backups.
- Add automated tests for authorization rules.

---

## Current Implementation Notes

These notes describe the repository as it currently exists and are useful before further development or deployment.

### 1. `.env` Files Are Tracked

Both backend and frontend `.env` files appear in the repository tree. Remove them from Git history/index and rotate any exposed credentials.

### 2. `node_modules` Is Tracked

The root/backend repository tree contains committed dependency folders. These should be removed from version control and recreated with `npm install`.

### 3. Development CORS Is Hard-Coded

`backend/server.js` currently allows only:

```text
http://localhost:5173
```

Production origins must be added or loaded from environment configuration before deployment.

### 4. Root `concurrently` Dependency

The root `package.json` uses the `concurrently` command but does not currently declare it as a root dependency/devDependency.

### 5. Camp Schema Contains `applicants` Twice

`backend/models/campsModel.js` currently declares the `applicants` property twice in the same schema object.

The earlier declaration contains the richer application information:

```text
applicationType
childName
childYear
parentPhone
leaderName
leaderRole
notes
```

The later declaration contains only:

```text
user
appliedAt
```

In a JavaScript object, the later property definition replaces the earlier property. The schema should be consolidated into one `applicants` definition so it matches `campController.js`.

### 6. Activity Authorization Middleware Mismatch

`userAuth.js` currently assigns:

```js
req.userId = decodedToken.id;
```

The activity controller's permission helper currently checks `req.user` in several operations. Unless `req.user` is populated elsewhere, management operations may fail their role check. The controller should load the user from `req.userId` or the authentication middleware should consistently populate the user object.

### 7. `pamela` Role Case Normalization

Some controllers normalize roles to lowercase while their allowed-role arrays contain `"pamela"` with a capital `P`.

For example, a normalized value of:

```text
pamela
```

will not equal:

```text
pamela
```

Role values and permission checks should use one consistent case everywhere.

### 8. Frontend / Backend Role Differences

Some backend controllers allow `pamela`, while some frontend pages only show management actions for:

```text
admin
leader
pascal
```

This can cause a role to be authorized by the API but not shown the corresponding UI control.

### 9. User ID Is Not Returned by `/api/user/data`

The current user-data response includes:

```text
name
isAccountVerified
role
email
phone
class
```

but not `_id`/`id`. Some frontend logic attempts to detect the current user ID for trip application state and admin UI behavior. Returning a safe user ID may simplify these checks.

### 10. Lesson Route Parameter Naming Is Inconsistent

Most lesson routes use:

```text
:lessonId
```

while the update route uses:

```text
:lessonid
```

The controller currently matches the lowercase form for updates, so it can work, but consistent naming is recommended.

### 11. PDF Dependencies Are Split Across Packages

`jspdf` and `html2pdf.js` are currently root dependencies while PDF functionality is implemented inside frontend source files. Moving frontend-only dependencies into `frontend/package.json` would make the frontend package more self-contained.

---

## Recommended Next Steps

### Backend Improvements

- Add a centralized error middleware.
- Add validation schemas for all request bodies.
- Add pagination for lessons, games, chants, activities, camps, and admin users.
- Add rate limiting.
- Add Helmet.
- Add API tests.
- Add authorization middleware such as `requireRole(...)` instead of repeating role checks in controllers.
- Add consistent HTTP response shapes and status codes.
- Add refresh-token/session strategy if longer sessions are required.

### Frontend Improvements

- Centralize role checks in one utility or hook.
- Add route-level role guards for create/edit/admin pages.
- Add loading skeletons.
- Add empty/error states consistently.
- Move all API calls to reusable service modules.
- Add form validation.
- Add automated component and integration tests.
- Add a dedicated route such as `/games/:id` for shareable game URLs instead of relying only on navigation state.

### DevOps Improvements

- Add GitHub Actions for linting and tests.
- Add Dockerfiles for frontend/backend or a single production container strategy.
- Add Docker Compose for local development.
- Add PM2/systemd configuration for VPS deployment.
- Add Nginx configuration.
- Add HTTPS with Let's Encrypt.
- Add MongoDB backups.
- Add weekly off-site backups for uploaded assets if local file storage is introduced.
- Add monitoring and structured application logs.

---

## Contributing

A suggested workflow:

```bash
# create a feature branch
git checkout -b feature/feature-name

# make changes

git add .
git commit -m "Add feature description"

git push origin feature/feature-name
```

Then open a pull request into `main`.

Recommended commit prefixes:

```text
feat: new feature
fix: bug fix
docs: documentation
refactor: code restructuring
style: UI/styling change
test: tests
chore: maintenance
```

---

## License

The backend package currently declares the `ISC` license, but the repository does not currently contain a dedicated root `LICENSE` file.

If this project is intended to be open source, add a root license file and document the selected license here.

If it is intended only for The Way Service / Saint George Church, replace this section with the appropriate private-use or organizational copyright statement.

---

## Maintainer Note

This README documents the current repository structure and implementation. Keep it updated whenever you add:

- New roles
- New API routes
- New MongoDB models or fields
- New frontend pages
- New environment variables
- New deployment requirements
- New authentication or authorization behavior

A README is most useful when it remains part of the development process rather than being updated only at release time.
