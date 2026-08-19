export default function Footer() {
  return (
    <>
      <section className="py-xl mb-xl">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-lg">
          <div className="bg-primary p-xl md:p-24 rounded-[32px] text-center relative overflow-hidden shadow-xl">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '40px 40px',
              }}
            ></div>
            <h2 className="font-headline-lg text-headline-lg md:text-[48px] text-on-primary mb-md leading-tight">
              Ready to start your journey?
            </h2>
            <p className="text-on-primary/80 font-body-lg mb-xl max-w-2xl mx-auto">
              Join thousands of travelers who have discovered the hidden gems and authentic experiences of our local region.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-on-secondary-fixed-variant dark:bg-inverse-surface full-width">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-xl px-xl py-xl w-full max-w-container-max mx-auto">
          <div className="space-y-md">
            <a className="font-headline-md text-headline-md text-on-primary block" href="/">
              Travigo
            </a>
            <p className="text-on-primary/70 font-body-md max-w-sm">
              Your ultimate guide to local adventures, authentic experiences, and hidden treasures in the heart of our region. Dedicated to sustainable and local tourism.
            </p>
          </div>
          <div className="flex flex-col gap-md">
            <h4 className="text-on-primary font-bold font-label-md">Quick Links</h4>
            <div className="grid grid-cols-2 gap-sm">
              <a className="text-on-primary/70 font-label-sm text-label-sm hover:text-secondary-fixed transition-colors opacity-80 hover:opacity-100" href="/">
                Home
              </a>
              <a className="text-on-primary/70 font-label-sm text-label-sm hover:text-secondary-fixed transition-colors opacity-80 hover:opacity-100" href="/contact">
                Contact
              </a>
              <a className="text-on-primary/70 font-label-sm text-label-sm hover:text-secondary-fixed transition-colors opacity-80 hover:opacity-100" href="/liked">
                Favourites
              </a>
              <a className="text-on-primary/70 font-label-sm text-label-sm hover:text-secondary-fixed transition-colors opacity-80 hover:opacity-100" href="/profile">
                Your Profile
              </a>
            </div>
          </div>
          <div className="space-y-md">
            <h4 className="text-on-primary font-bold font-label-md">Stay Connected</h4>
            <div className="flex gap-md mb-xl">
              <span className="material-symbols-outlined text-on-primary cursor-pointer hover:text-secondary-fixed transition-colors">
                public
              </span>
              <span className="material-symbols-outlined text-on-primary cursor-pointer hover:text-secondary-fixed transition-colors">
                mail
              </span>
              <span className="material-symbols-outlined text-on-primary cursor-pointer hover:text-secondary-fixed transition-colors">
                share
              </span>
            </div>
            <p className="text-on-primary/70 font-label-sm text-label-sm">
              © 2024 Travigo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
