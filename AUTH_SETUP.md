# WorkOS AuthKit Setup for ReacherX

This document outlines the authentication setup using WorkOS AuthKit for the ReacherX project.

## Overview

ReacherX uses WorkOS AuthKit for authentication, which provides:

- Google OAuth sign-in as the primary authentication method
- Scalable enterprise-ready authentication
- Session management and security
- Integration with Convex backend

## Setup Instructions

### 1. WorkOS Dashboard Configuration

1. Create a WorkOS account at [dashboard.workos.com](https://dashboard.workos.com)
2. Activate AuthKit in your WorkOS Dashboard
3. Configure the following in your WorkOS Dashboard:

#### Redirect URIs

- Add `http://localhost:3000/callback` for development
- Add your production callback URL for production

#### Initiate Login URL

- Add `http://localhost:3000/login` for development
- Add your production login URL for production

#### Logout Redirect

- Add `http://localhost:3000` for development
- Add your production home URL for production

### 2. Environment Variables

Create a `.env.local` file with the following variables:

```env
# WorkOS AuthKit Configuration
WORKOS_API_KEY='your_workos_api_key_here'
WORKOS_CLIENT_ID='your_workos_client_id_here'
WORKOS_COOKIE_PASSWORD="your_secure_cookie_password_here_min_32_chars"

# Configured in the WorkOS dashboard
NEXT_PUBLIC_WORKOS_REDIRECT_URI="http://localhost:3000/callback"
```

### 3. Generate Secure Cookie Password

Generate a secure 32-character password using:

```bash
openssl rand -base64 32
```

### 4. Google OAuth Setup

1. In your WorkOS Dashboard, go to the Authentication section
2. Enable Google as a provider
3. Configure Google OAuth credentials
4. Add your domain to the allowed origins

## Authentication Flow

1. **Sign In**: Users visit `/login` and are redirected to WorkOS AuthKit
2. **Authentication**: Users authenticate with Google through WorkOS
3. **Callback**: Users are redirected back to `/callback` where the session is established
4. **Protected Routes**: Middleware protects routes and redirects unauthenticated users
5. **Sign Out**: Users can sign out via `/logout`

## Protected Routes

The following routes require authentication:

- `/dashboard` - User dashboard
- `/search` - Search functionality
- `/onboarding` - User onboarding (after initial auth)

Public routes:

- `/` - Landing page
- `/auth` - Authentication page
- `/login` - Login redirect
- `/callback` - Auth callback
- `/logout` - Logout redirect

## Usage in Components

### Server Components

```typescript
import { withAuth } from '@workos-inc/authkit-nextjs';

export default async function ProtectedPage() {
  const { user } = await withAuth({ ensureSignedIn: true });
  return <div>Welcome, {user.firstName}!</div>;
}
```

### Client Components

```typescript
import { useAuth } from '@workos-inc/authkit-nextjs/components';

export default function MyComponent() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;

  return <div>Welcome, {user.firstName}!</div>;
}
```

## Convex Integration

The authentication system is designed to work with Convex:

- User data is stored in Convex after authentication
- Social media account linking will be implemented
- Search functionality will be protected

## Next Steps

1. Set up your WorkOS account and configure the dashboard
2. Add the environment variables
3. Test the authentication flow
4. Implement social media account linking
5. Add more authentication providers as needed

## Troubleshooting

- Ensure all environment variables are set correctly
- Check that redirect URIs match exactly in WorkOS Dashboard
- Verify the cookie password is at least 32 characters
- Check browser console for any authentication errors
