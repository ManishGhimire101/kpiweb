# User Roles & Workflows

## Roles
- Admin: full control — user management, content moderation, system settings
- Staff/Teacher: content creation, resource uploads, notices
- Student: view resources, download materials, submit files (if permitted)
- Parent: read-only access to notices and student-related resources

## Typical Workflows

1) Uploading a Resource (Staff)
- Staff logs in, opens upload form, selects category and file
- Server validates and stores file in `uploads/`
- Metadata saved to the DB and resource appears in listings

2) Publishing a Notice (Teacher/Admin)
- Create notice from admin panel, add attachments
- Publish which notifies subscribed users via chosen channels (email/SMS)

3) Student Access
- Students browse program pages, download materials, and view notices
- Optionally submit assignments via `POST /api/upload` to a specific category

4) Admin Maintenance
- Run moderation tasks, remove inappropriate files, manage user roles
- Review audit logs and create manual backups when required

## Operational Considerations
- Provide training docs for non-technical staff to use the admin UI
- Implement rate-limits for APIs to prevent abuse
