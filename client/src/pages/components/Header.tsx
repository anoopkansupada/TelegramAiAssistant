vimport React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'react-feather';

const Header = () => {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <Link to="/" className="flex items-center">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>
      </div>
    </header>
  );
};

export default Header;
