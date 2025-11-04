
# How to Get Your Clerk Authentication Cookie

The tokens you provided are **Google session cookies**, but your app uses **Clerk authentication**. You need to get the Clerk session cookie instead.

## Step-by-Step Instructions

### Method 1: Using Browser DevTools (Chrome/Edge)

1. **Open your application** in a browser while logged in:
   - Go to `http://localhost:3000` (or your app URL)
   - Make sure you're logged in

2. **Open DevTools**:
   - Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Or right-click → Inspect

3. **Navigate to Cookies**:
   - Go to the **Application** tab (Chrome/Edge)
   - In the left sidebar, expand **Cookies**
   - Click on `http://localhost:3000` (or your domain)

4. **Find the Clerk session cookie**:
   - Look for cookies named like:
     - `__session` (most common)
     - `__clerk_db_jwt`
     - `clerk-session` or similar
   - The cookie name may vary based on your Clerk configuration

5. **Copy the cookie value**:
   - Click on the cookie name
   - Copy the **Value** field
   - Format: `__session=your-cookie-value-here`

### Method 2: Using Browser Console

You can also get the cookie using JavaScript in the browser console:

```javascript
// Open browser console (F12) while on your app
document.cookie
```

This will show all cookies as a string like:
```
__session=eyJ...; other-cookie=value
```

Copy the `__session=...` part.

### Method 3: Using Network Tab

1. Open DevTools → **Network** tab
2. Make a request to your app (refresh the page)
3. Click on any request
4. Go to **Headers** → **Request Headers**
5. Look for the `Cookie:` header
6. Copy the entire cookie string

## Using the Cookie in Tests

Once you have the cookie, use it like this:

```bash
# Format: CookieName=CookieValue
TEST_AUTH_COOKIE="__session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." npm run test:stress
```

Or with command-line argument:

```bash
npm run test:stress -- --authCookie="__session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Multiple Cookies

If you need to send multiple cookies, separate them with semicolons:

```bash
TEST_AUTH_COOKIE="__session=value1; other-cookie=value2" npm run test:stress
```

## Important Notes

- **Cookie names are case-sensitive**
- **Cookie values are long strings** - make sure to copy the entire value
- **Cookies expire** - if your test fails with 401, the cookie may have expired. Get a fresh one.
- **Don't commit cookies** - never put real cookies in version control

## Troubleshooting

### "401 Unauthorized" Error
- Cookie may have expired → Get a fresh cookie
- Cookie format is wrong → Make sure it's `CookieName=Value` format
- Wrong cookie → Make sure you're using the Clerk session cookie, not Google cookies

### Can't Find Clerk Cookie
- Make sure you're logged into the app
- Check if cookies are being blocked by your browser
- Try a different browser or incognito mode
- Check Clerk dashboard for cookie name configuration

