export default function LoginSelectionPage() {
  return (
    <main className="flex-grow flex items-center justify-center bg-surface-container-low px-margin-mobile py-xl relative overflow-hidden min-h-[650px]">
      {/* Decorative background glow elements */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-3xl bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-surface-variant/40 p-6 md:p-12 relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-4">
            <span className="material-symbols-outlined text-[32px]">lock</span>
          </div>
          <h1 className="font-display-lg text-headline-lg md:text-[36px] font-bold text-on-surface mb-2">
            Welcome to Travigo
          </h1>
          <p className="font-body-md text-on-surface-variant max-w-md mx-auto">
            Please select your portal to log in to your account
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Login Card */}
          <a
            href="/user-login"
            className="group flex flex-col items-center text-center p-8 rounded-xl border border-surface-variant/60 bg-surface-container-lowest hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-[36px]">person</span>
            </div>
            <h2 className="font-headline-md text-xl font-bold text-on-surface mb-2 group-hover:text-primary transition-colors">
              User Login
            </h2>
            <p className="font-body-md text-on-surface-variant text-sm mb-6 flex-grow">
              Access your travel itinerary, package bookings, and saved favorite places.
            </p>
            <span className="w-full py-3 px-6 bg-primary text-on-primary font-label-md rounded-lg shadow-sm group-hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              <span>Continue as User</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </span>
          </a>

          {/* Admin Login Card */}
          <a
            href="/admin/login"
            className="group flex flex-col items-center text-center p-8 rounded-xl border border-surface-variant/60 bg-surface-container-lowest hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-[36px]">admin_panel_settings</span>
            </div>
            <h2 className="font-headline-md text-xl font-bold text-on-surface mb-2 group-hover:text-primary transition-colors">
              Admin Login
            </h2>
            <p className="font-body-md text-on-surface-variant text-sm mb-6 flex-grow">
              Access the admin dashboard to manage packages, approve bookings, and monitor activity.
            </p>
            <span className="w-full py-3 px-6 bg-primary text-on-primary font-label-md rounded-lg shadow-sm group-hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              <span>Continue as Admin</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </span>
          </a>
        </div>
      </div>
    </main>
  );
}
