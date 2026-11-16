# API Surface, Data Model & Storage

## API Overview
- RESTful endpoints under `router/api/` (see `router/api/program.js`, `router/api/upload.js`)
- Typical endpoints: `GET /api/resources`, `POST /api/upload`, `GET /api/programs`
- Endpoints should return JSON and appropriate HTTP status codes

## Suggested Data Model (Prisma)
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  role      String
  createdAt DateTime @default(now())
}

model Resource {
  id          Int      @id @default(autoincrement())
  title       String
  description String?
  filePath    String
  category    String
  uploadedBy  Int
  createdAt   DateTime @default(now())
}

model Notice {
  id        Int      @id @default(autoincrement())
  title     String
  body      String
  authorId  Int?
  createdAt DateTime @default(now())
}

## Files & Storage
- Files stored on disk under `uploads/` organized by category (notices, staff, home, etc.)
- For production, replace disk storage with object storage (S3) and save URL in DB

## Example API Contract
- `POST /api/upload` — accepts multipart form-data, fields: `category`, `title`, file
- `GET /api/resources?category=library` — paginated list of resources
- `POST /api/users` — create user (admin only)

## Validation and Error Handling
- Validate file types and sizes server-side in `api/upload.js`
- Return helpful error messages and use central error handler middleware
