# How to Get Your Telegram Session String

Follow these steps to get your Telegram session string:

1. Install Node.js on your local computer if you haven't already (https://nodejs.org)

2. Open a terminal/command prompt and run:
```bash
npm install -g telegram-cli
telegram-cli
```

3. When prompted, enter these credentials:
   - API ID: 20186468
   - API Hash: 5462496a1c6075aa3e29754a1e3ee494

4. Next you'll be asked for:
   - Your phone number (in international format, e.g., +1234567890)
   - The verification code sent to your Telegram app
   - Your 2FA password (if you have it enabled)

5. After successful authentication, you'll see a session string that looks like a long string of characters.

6. Copy that entire session string and set it as your `TELEGRAM_SESSION` secret in Replit:
   - Go to "Tools" > "Secrets"
   - Add a new secret with key: `TELEGRAM_SESSION`
   - Paste the session string as the value

Alternative Method (Using Python):
If the above method doesn't work, you can also use this Python script locally:

```python
from telethon import TelegramClient
from telethon.sessions import StringSession

api_id = 20186468
api_hash = '5462496a1c6075aa3e29754a1e3ee494'

with TelegramClient(StringSession(), api_id, api_hash) as client:
    print("Please sign in to Telegram\n")
    client.start()
    print("\nYour session string is:\n")
    print(client.session.save())
```

Save this as `get_session.py` and run:
```bash
pip install telethon
python get_session.py
```

Important Notes:
1. Keep your session string secure - it provides access to your Telegram account
2. Never share your session string with anyone
3. If you need to revoke access, you can do so from your Telegram app's Settings > Privacy and Security > Active Sessions
