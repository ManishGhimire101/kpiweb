# Deployment, Security & Maintenance

## Deployment Recommendations
- Development: SQLite with local Prisma for quick iteration
- Production: Postgres (managed) and object storage (S3-compatible) for uploads
- Use environment variables for DB credentials and secrets (e.g., `DATABASE_URL`)
- Containerize with Docker for reproducible deployments

## Security Best Practices
- Use HTTPS (TLS) for all connections
- Implement authentication and RBAC; limit admin endpoints
- Sanitize and validate all inputs to prevent injection attacks
- Scan uploaded files for malware and restrict executable MIME types
- Secure Prisma credentials and use least-privilege DB users

## Backups & Monitoring
- Automated DB backups and off-site storage for uploads
- Logging for requests, errors, and audit trails
- Monitor disk usage of `uploads/` and set lifecycle policies for old files

## Maintenance Tasks
- Keep dependencies up to date and run security audits
- Periodic DB migrations and data integrity checks
- Provide a maintenance page and scheduling for downtimes

## Testing Strategy
- Unit tests for core services and API endpoints
- End-to-end tests for critical user journeys (upload, download, notice create)
- Automated CI pipeline to run tests and linting on PRs
