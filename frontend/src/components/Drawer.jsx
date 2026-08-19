import { useEffect, useState } from 'react';

export default function Drawer({ isOpen, toggleDrawer }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('access_token'));
    setIsAdmin(localStorage.getItem('is_admin') === 'true');
  }, []);

  const path = window.location.pathname;

  const drawerLink = (href, icon, label, extra = '') => (
    <a
      className={`flex items-center gap-md p-md rounded-xl font-label-md transition-colors ${
        path === href
          ? 'bg-primary/10 text-primary'
          : `hover:bg-primary/5 text-on-surface ${extra}`
      }`}
      href={href}
    >
      <span className="material-symbols-outlined">{icon}</span>
      {label}
    </a>
  );

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        id="drawer-overlay"
        onClick={toggleDrawer}
      ></div>

      <aside
        className={`fixed top-0 right-0 h-full w-[280px] bg-surface z-[70] shadow-2xl transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        id="nav-drawer"
      >
        <div className="flex flex-col h-full p-lg">
          <div className="flex justify-between items-center mb-xl">
            <h2 className="font-headline-md text-primary">Menu</h2>
            <button
              aria-label="Close Menu"
              className="p-2 rounded-full hover:bg-surface-container transition-colors"
              onClick={toggleDrawer}
            >
              <span className="material-symbols-outlined text-on-surface">close</span>
            </button>
          </div>
          <nav className="flex flex-col gap-sm">
            {drawerLink('/', 'home', 'Home')}
            {drawerLink('/packages', 'flight_takeoff', 'Packages')}
            {drawerLink('/about', 'info', 'About Us')}
            {drawerLink('/contact', 'mail', 'Contact Us')}
            {drawerLink('/liked', 'favorite', 'Favourites')}
            {isLoggedIn && drawerLink('/profile', 'person', 'Profile')}
            {isLoggedIn && drawerLink('/my-bookings', 'receipt_long', 'My Bookings')}
            {isAdmin && (
              <a
                className={`flex items-center gap-md p-md rounded-xl font-label-md transition-colors ${
                  path === '/admin'
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                }`}
                href="/admin"
              >
                <span className="material-symbols-outlined">admin_panel_settings</span>
                Admin Panel
              </a>
            )}
            {isLoggedIn ? (
              <button
                className="mt-auto bg-primary text-on-primary p-md rounded-xl text-center font-label-md shadow-md active:scale-95 transition-transform w-full"
                onClick={() => {
                  localStorage.removeItem('access_token');
                  localStorage.removeItem('is_admin');
                  window.location.href = '/';
                }}
              >
                Logout
              </button>
            ) : (
              <a
                className="mt-auto bg-primary text-on-primary p-md rounded-xl text-center font-label-md shadow-md active:scale-95 transition-transform"
                href="/login"
              >
                Login / Sign Up
              </a>
            )}
          </nav>
          <div className="mt-xl pt-xl border-t border-surface-container-high">
            <p className="text-on-surface-variant text-label-sm mb-md">Follow Us</p>
            <div className="flex gap-md text-primary font-bold">
              <span className="material-symbols-outlined cursor-pointer hover:opacity-70">
                public
              </span>
              <span className="material-symbols-outlined cursor-pointer hover:opacity-70">
                share
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
