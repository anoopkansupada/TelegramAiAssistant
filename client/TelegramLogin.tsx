import React, { useState } from 'react';

const TelegramLogin = () => {
    const [apiKey, setApiKey] = useState('');
    const [apiHash, setApiHash] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle the submission of credentials
        // This could involve sending the credentials to the server for validation
        // and initiating the user bot with the provided credentials
    };

    return (
        <div className="telegram-login">
            <h2>Telegram Login</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="apiKey">API Key:</label>
                    <input
                        type="text"
                        id="apiKey"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="apiHash">API Hash:</label>
                    <input
                        type="text"
                        id="apiHash"
                        value={apiHash}
                        onChange={(e) => setApiHash(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Login</button>
            </form>
        </div>
    );
};

export default TelegramLogin;
