import { useState, useEffect } from 'react';

export default function Header({ toggleDrawer }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    // Check auth state from localStorage
    setIsLoggedIn(!!localStorage.getItem('access_token'));
    setIsAdmin(localStorage.getItem('is_admin') === 'true');

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const path = window.location.pathname;
  const navLink = (href, label) => (
    <a
      href={href}
      className={`text-on-primary hover:text-on-primary/80 font-label-md transition-colors ${path === href ? 'underline decoration-2 underline-offset-8 font-bold' : ''
        }`}
    >
      {label}
    </a>
  );

  return (
    <header
      id="top-app-bar"
      className={`bg-primary dark:bg-primary-container full-width top-0 sticky z-50 shadow-md transition-all duration-300 ${isScrolled ? 'bg-primary/95 backdrop-blur-md' : ''
        }`}
    >
      <nav
        className={`flex justify-between items-center px-lg w-full max-w-container-max mx-auto transition-all duration-300 ${isScrolled ? 'py-sm' : 'py-md'
          }`}
      >
        <div className="flex items-center gap-xl">
          <a
            href="/"
            className="font-display-lg text-display-lg font-bold text-on-primary whitespace-nowrap"
          >
            Travigo
          </a>
          <div className="hidden lg:flex items-center gap-lg desktop-nav-links">
            {navLink('/', 'Home')}
            {navLink('/packages', 'Packages')}
            {isLoggedIn && navLink('/my-bookings', 'My Bookings')}
            {navLink('/liked', 'Favourites')}
            {navLink('/contact', 'Contact Us')}
          </div>
        </div>
        <div className="flex items-center gap-md">
          <div className="hidden md:flex items-center gap-md">
            {isAdmin && (
              <a
                href="/admin"
                className="text-on-primary hover:bg-on-primary/10 px-md py-sm rounded-lg font-label-md transition-colors inline-flex items-center gap-xs bg-on-primary/10"
              >
                <span className="material-symbols-outlined align-middle mr-xs">admin_panel_settings</span>
                Admin
              </a>
            )}

            {isLoggedIn ? (
              <>
                <a
                  href="/profile"
                  className="text-on-primary hover:bg-on-primary/10 px-md py-sm rounded-lg font-label-md transition-colors inline-flex items-center gap-xs"
                >
                  <span className="material-symbols-outlined align-middle mr-xs">person</span>
                  Profile
                </a>
                <button
                  onClick={() => {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('is_admin');
                    window.location.href = '/';
                  }}
                  className="bg-on-primary text-primary px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all shadow-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="bg-on-primary text-primary px-lg py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all shadow-sm"
              >
                Login
              </a>
            )}
          </div>
          <button
            aria-label="Open Menu"
            className="flex items-center justify-center p-2 rounded-full hover:bg-on-primary/10 transition-colors lg:hidden"
            onClick={toggleDrawer}
          >
            <span className="material-symbols-outlined text-on-primary cursor-pointer text-[28px]">
              menu
            </span>
          </button>
        </div>
      </nav>
    </header>
  );
}
