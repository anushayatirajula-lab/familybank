# Push Notification Setup Guide

Your app now supports push notifications! To enable them, you need to configure VAPID keys.

## What are VAPID Keys?

VAPID (Voluntary Application Server Identification) keys are cryptographic keys required for sending push notifications to browsers. They identify your application server and prevent unauthorized push notifications.

## Step 1: Generate VAPID Keys

### Option A: Using npx web-push (Recommended)

1. Run this command in your terminal:
   ```bash
   npx web-push generate-vapid-keys
   ```

2. You'll see output like this:
   ```
   =======================================
   Public Key:
   BMxY...your-public-key...XYZ
   
   Private Key:
   abc123...your-private-key...xyz789
   =======================================
   ```

### Option B: Using Online Generator

Visit: https://vapidkeys.com/

## Step 2: Add Keys to Your Project

### For Frontend (Vite Environment Variable)

1. Create or edit `.env` file in your project root:
   ```bash
   VITE_VAPID_PUBLIC_KEY=your_public_key_here
   ```

2. Add this to your production environment variables in Lovable:
   - Go to Project Settings → Environment Variables
   - Add `VITE_VAPID_PUBLIC_KEY` with your public key

### For Backend (Supabase Secrets)

You'll need to add these secrets via Lovable:

1. **VAPID_PUBLIC_KEY** - Your VAPID public key
2. **VAPID_PRIVATE_KEY** - Your VAPID private key

## Step 3: Test Notifications

After setting up VAPID keys:

1. Open your app in a browser that supports push notifications (Chrome, Firefox, Edge)
2. Log in as a parent
3. Click "Enable Notifications" when prompted
4. Test by having a child submit a chore for approval
5. You should receive a push notification!

## Supported Events

Your app will send push notifications for:

- ✅ **Chore Approvals** - When parents approve chores
- ✅ **Allowance Payments** - When weekly allowances are processed
- ✅ **Wishlist Updates** - When wishlist items are approved

## Browser Support

Push notifications work on:
- ✅ Chrome (Desktop & Android)
- ✅ Firefox (Desktop & Android)
- ✅ Edge (Desktop & Android)
- ✅ Samsung Internet
- ✅ Opera

Not currently supported:
- ❌ Safari on iOS (Apple limitation)
- ❌ Safari on macOS (requires additional setup)

## Sending Test Notifications

To manually send a test notification, use the Lovable backend:

```typescript
await supabase.functions.invoke('send-push-notification', {
  body: {
    userId: 'user-uuid-here',
    title: 'Test Notification',
    body: 'This is a test!',
    url: '/'
  }
});
```

## Troubleshooting

### "VAPID keys not configured" message
- Make sure you've added both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets
- Verify the keys don't have extra spaces or line breaks
- Redeploy your edge functions after adding secrets

### Notifications not appearing
- Check browser notification permissions (should be "Allow")
- Verify your app is served over HTTPS
- Check browser console for errors
- Test in an incognito/private window

### Push subscription fails
- Ensure VITE_VAPID_PUBLIC_KEY is set in frontend environment
- Verify the public key matches between frontend and backend
- Check if service worker is properly registered

## Security Notes

- ⚠️ **Never commit VAPID keys to version control**
- ⚠️ Keep your private key secure and never expose it in frontend code
- ⚠️ Use different VAPID keys for development and production
- ⚠️ Store keys as environment variables/secrets, not in code

## Next Steps

Once VAPID keys are configured:

1. The `send-push-notification` edge function will automatically send notifications
2. Users can enable/disable notifications from their profile
3. Notifications are logged in the `notifications` table for tracking
4. Invalid subscriptions are automatically cleaned up

For more information, see the [Web Push API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).
