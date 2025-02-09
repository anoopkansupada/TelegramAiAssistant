import React from 'react';

export function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-4">
        <p className="text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} TelegramCRM. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
