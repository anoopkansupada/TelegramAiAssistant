TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   TELEGRAM_PHONE_NUMBER=your_phone_number
   ```
   Note: Phone number should be in international format (e.g., +1234567890)

3. Run the authentication script:
   ```bash
   npm run auth:telegram
   ```

4. You'll see a message that a verification code has been sent to your Telegram app.

5. Set the verification code as an environment variable:
   ```
   TELEGRAM_CODE=the_code_you_received
   ```

6. Run the completion script:
   ```bash
   npm run auth:telegram:complete