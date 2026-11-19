# Cloudflare DNS Configuration for Multi-Tenant Shikshya Platform

## Overview

| Domain | Purpose |
|--------|---------|
| `manishghimire.info.np` | Your portfolio site (keep separate) |
| `shikshya.manishghimire.info.np` | **Main landing page** for Shikshya platform |
| `super.shikshya.manishghimire.info.np` | **Super Admin** panel |
| `*.shikshya.manishghimire.info.np` | **All institutions** (wildcard) |
| `institution1.shikshya.manishghimire.info.np` | Individual institution portals |

---

## Cloudflare DNS Records

Go to **Cloudflare Dashboard → DNS → Records** and add:

### 1. Main Landing Page (Root of Shikshya)

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| `CNAME` | `shikshya` | `your-render-app.onrender.com` | ✅ Proxied | Auto |

### 2. Super Admin Subdomain

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| `CNAME` | `super.shikshya` | `your-render-app.onrender.com` | ✅ Proxied | Auto |

### 3. Wildcard for All Institutions (⭐ Key for Multi-Tenancy)

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| `CNAME` | `*.shikshya` | `your-render-app.onrender.com` | ✅ Proxied | Auto |

---

## Render Configuration

### Environment Variables (Render Dashboard → Environment)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secure-secret
SESSION_SECRET=your-secure-secret
PORT=3000
ROOT_DOMAIN=shikshya.manishghimire.info.np
SUPER_SUBDOMAIN=super
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=your-secure-password
```

### Custom Domains (Render Dashboard → Settings → Custom Domains)

Add these **exact domains** to your Render service:

1. `shikshya.manishghimire.info.np`
2. `super.shikshya.manishghimire.info.np`
3. `*.shikshya.manishghimire.info.np` (wildcard)

> **Note:** Render supports wildcard custom domains on paid plans. If on free tier, you'll need to add each institution subdomain manually as you create them.

---

## How It Works

### Request Flow

```
User visits: school1.shikshya.manishghimire.info.np
                    ↓
Cloudflare DNS: *.shikshya → your-render-app.onrender.com
                    ↓
Render: Receives request with Host header = "school1.shikshya.manishghimire.info.np"
                    ↓
Your App (tenant.js):
  1. parseHost() extracts hostname
  2. getRootDomain() returns "shikshya.manishghimire.info.np"
  3. hostname.endsWith(".shikshya.manishghimire.info.np") → TRUE
  4. label = "school1" (extracted)
  5. Prisma lookup: Institution.where({ subdomain: "school1" })
  6. Returns { kind: "institution", institution: {...} }
```

### Creating New Institutions

When super admin creates an institution via API:

```json
POST /api/super-admin/institutions
{
  "name": "Shikshya School",
  "code": "SHS001",
  "subdomain": "shikshya-school",
  "customDomain": null
}
```

The institution becomes accessible at:
- **Subdomain:** `https://shikshya-school.shikshya.manishghimire.info.np`
- **Custom Domain (optional):** `https://school.example.com` (if configured)

---

## SSL/TLS Settings (Cloudflare)

1. **SSL/TLS Mode:** `Full (strict)` 
2. **Always Use HTTPS:** ✅ On
3. **Automatic HTTPS Rewrites:** ✅ On
4. **Minimum TLS Version:** 1.2

---

## Page Rules (Optional but Recommended)

### Rule 1: Cache Landing Page
```
URL: shikshya.manishghimire.info.np/*
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 2 hours
- Browser Cache TTL: 1 hour
```

### Rule 2: Bypass Cache for API & Admin
```
URL: shikshya.manishghimire.info.np/api/*
URL: super.shikshya.manishghimire.info.np/*
URL: *.shikshya.manishghimire.info.np/api/*
Settings:
- Cache Level: Bypass
- Disable Performance: On
```

### Rule 3: Force HTTPS for All
```
URL: *shikshya.manishghimire.info.np/*
Settings:
- Always Use HTTPS: On
```

---

## Testing Checklist

After DNS propagates (5-30 mins):

| Test | Expected Result |
|------|-----------------|
| `https://shikshya.manishghimire.info.np` | Landing page loads |
| `https://super.shikshya.manishghimire.info.np` | Super admin login page |
| `https://demo.shikshya.manishghimire.info.np` | Institution portal (if demo institution exists with subdomain="demo") |
| `https://shikshya.manishghimire.info.np/api/health` | `{ success: true, status: "OK" }` |

---

## Troubleshooting

### "Institution not found" on valid subdomain
1. Check institution exists in DB with exact `subdomain` value
2. Verify `isActive: true` on institution
3. Check Render custom domain includes wildcard

### SSL Certificate Errors
1. Ensure Cloudflare SSL = "Full (strict)"
2. Wait for Render to provision cert (can take 10-15 mins after adding custom domain)
3. Check Cloudflare "Universal SSL" is active

### Wildcard Not Working on Render Free Tier
- Upgrade to Render paid plan for wildcard support
- OR manually add each institution subdomain in Render Custom Domains

---

## Production Checklist

- [ ] DNS records added in Cloudflare
- [ ] Custom domains added in Render (including wildcard)
- [ ] Environment variables set in Render
- [ ] SSL certificates provisioned (green lock in browser)
- [ ] Super admin can create institutions
- [ ] New institution accessible via `subdomain.shikshya.manishghimire.info.np`
- [ ] Custom domain institution works (if configured)
- [ ] Portfolio site `manishghimire.info.np` unaffected