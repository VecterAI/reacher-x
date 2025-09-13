# WorkOS Integration Setup

## Required Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# WorkOS Configuration
WORKOS_API_KEY=your_workos_api_key
WORKOS_CLIENT_ID=your_workos_client_id
WORKOS_WEBHOOK_SECRET=your_webhook_secret
```

## Webhook Configuration

1. Go to your WorkOS Dashboard
2. Navigate to "Webhooks" section
3. Create a new webhook with the following settings:
   - **Endpoint URL**: `https://yourdomain.com/api/events/process`
   - **Events**: Select the following events:
     - `dsync.user.created`
     - `dsync.user.updated`
     - `dsync.user.deleted`
   - **Secret**: Use the same value as `WORKOS_WEBHOOK_SECRET`

## How It Works

### User Deletion Flow

1. **WorkOS Deletion**: When a user is deleted in WorkOS, it sends a `dsync.user.deleted` webhook
2. **Webhook Processing**: The webhook endpoint verifies the signature and processes the event
3. **Database Cleanup**: The system:
   - Hard deletes the user from Convex database
   - Removes all associated social accounts
   - Removes all associated threads
   - Logs the deletion event for audit purposes
4. **Session Invalidation**: The frontend automatically detects the user deletion and redirects to logout

### Session Management

- **Real-time Detection**: The `useStoreUserEffect` hook monitors user existence
- **Periodic Validation**: Every 30 seconds, the system validates the user session
- **Automatic Logout**: If a user is deleted, they are automatically logged out

### Security Features

- **Webhook Signature Verification**: All webhooks are verified using WorkOS signatures
- **Hard Delete**: Deleted users are completely removed from the database
- **Audit Logging**: All deletion events are logged for compliance

## Testing

To test the integration:

1. Create a user in WorkOS
2. Verify they can log in to your application
3. Delete the user in WorkOS
4. Verify they are automatically logged out within 30 seconds

## Troubleshooting

### User Still Logged In After Deletion

1. Check webhook configuration in WorkOS dashboard
2. Verify `WORKOS_WEBHOOK_SECRET` matches the webhook secret
3. Check server logs for webhook processing errors
4. Ensure the webhook endpoint is accessible from WorkOS

### Webhook Not Receiving Events

1. Verify the webhook URL is correct and accessible
2. Check that the correct events are selected in WorkOS
3. Test the webhook endpoint manually using WorkOS webhook testing tools
