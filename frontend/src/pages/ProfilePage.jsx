import { useState, useEffect } from 'react';
import { useLikedPlaces } from '../hooks/useLikedPlaces';
import { getProfile, updateProfile } from '../services/api';

export default function ProfilePage() {
  const { likedPlaces } = useLikedPlaces();

  // ── Profile data from server ───────────────────────────────
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Edit-mode state ────────────────────────────────────────
  const [isEditing, setIsEditing]     = useState(false);
  const [editName, setEditName]       = useState('');
  const [editMobile, setEditMobile]   = useState('');

  // ── Save feedback ──────────────────────────────────────────
  const [isSaving, setIsSaving]     = useState(false);
  const [saveError, setSaveError]   = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Fetch profile on mount ─────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    getProfile()
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('is_admin');
        window.location.href = '/login';
      });
  }, []);

  // ── Open edit mode — prefill inputs with current values ────
  const handleEdit = () => {
    setEditName(user?.full_name || '');
    setEditMobile(user?.mobile || '');
    setSaveError('');
    setSaveSuccess(false);
    setIsEditing(true);
  };

  // ── Cancel edit — discard changes ──────────────────────────
  const handleCancel = () => {
    setIsEditing(false);
    setSaveError('');
    setSaveSuccess(false);
  };

  // ── Save changes ───────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);

    // ── Client-side validation ──────────────────────────────
    const trimmedName   = editName.trim();
    const trimmedMobile = editMobile.trim();

    if (!trimmedName) {
      setSaveError('Full name is required.');
      return;
    }
    if (trimmedName.length < 2) {
      setSaveError('Full name must be at least 2 characters.');
      return;
    }
    if (!trimmedMobile) {
      setSaveError('Mobile number is required.');
      return;
    }
    if (!/^\+?[0-9]{10,15}$/.test(trimmedMobile)) {
      setSaveError('Enter a valid mobile number (10–15 digits).');
      return;
    }

    // ── Call API ────────────────────────────────────────────
    setIsSaving(true);
    try {
      const updated = await updateProfile({ full_name: trimmedName, mobile: trimmedMobile });
      setUser(updated);          // refresh displayed data immediately
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      let errMsg = 'Failed to save changes. Please try again.';
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        errMsg = detail;
      } else if (Array.isArray(detail)) {
        errMsg = detail.map((d) => d.msg || d.message || JSON.stringify(d)).join(', ');
      } else if (typeof detail === 'object' && detail !== null) {
        errMsg = detail.msg || detail.message || JSON.stringify(detail);
      }
      setSaveError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading spinner ────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-lg lg:px-xl py-xl flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#874f9e]" />
      </main>
    );
  }

  return (
    <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-lg lg:px-xl py-xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">

        {/* ── Sidebar ────────────────────────────────────────── */}
        <aside className="lg:col-span-4 flex flex-col gap-lg">
          <div
            className="bg-surface-container-low rounded-xl p-lg lg:p-xl border border-surface-variant flex flex-col items-center text-center"
            style={{ boxShadow: '0px 4px 20px rgba(94,54,112,0.08)' }}
          >
            {/* Avatar */}
            <div className="relative group cursor-pointer">
              <div className="w-40 h-40 rounded-full border-4 border-[#874f9e] overflow-hidden bg-surface-variant">
                <img
                  className="w-full h-full object-cover"
                  alt="Profile photo"
                  src="https://randomuser.me/api/portraits/lego/5.jpg"
                />
              </div>
              <div
                className="absolute bottom-2 right-2 bg-primary text-on-primary rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ boxShadow: '0px 10px 30px rgba(94,54,112,0.12)' }}
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
              </div>
            </div>

            <div className="mt-lg">
              <h2 className="font-headline-lg text-headline-lg text-on-surface">{user?.full_name}</h2>
              <p className="font-label-md text-label-md text-on-surface-variant">{user?.email}</p>
            </div>

            <div className="w-full mt-xl pt-lg border-t border-outline-variant flex justify-around">
              <div className="flex flex-col items-center">
                <span className="font-headline-md text-headline-md text-primary">{likedPlaces.length}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Liked</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-headline-md text-headline-md text-primary">4</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Reviews</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-headline-md text-headline-md text-primary">8</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Trips</span>
              </div>
            </div>
          </div>

          {/* Liked Places Preview */}
          <div
            className="bg-surface-container-low rounded-xl p-lg border border-surface-variant"
            style={{ boxShadow: '0px 4px 20px rgba(94,54,112,0.08)' }}
          >
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-label-md text-label-md text-[#5e3670]">My Liked Places</h3>
              <span className="bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-label-md">
                {likedPlaces.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-sm">
              {likedPlaces.slice(0, 3).map((place, i) => (
                <span
                  key={i}
                  className="bg-surface-container text-[#5e3670] font-label-sm px-3 py-1 rounded-lg border border-surface-variant"
                >
                  {place.name}
                </span>
              ))}
              {likedPlaces.length > 3 && (
                <a className="text-primary font-label-sm px-2 py-1 hover:underline" href="/liked">
                  +{likedPlaces.length - 3} more
                </a>
              )}
              {likedPlaces.length === 0 && (
                <p className="text-on-surface-variant text-label-sm">
                  No liked places yet.{' '}
                  <a href="/" className="text-primary hover:underline">Explore now!</a>
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* ── Account Settings Panel ─────────────────────────── */}
        <section className="lg:col-span-8">
          <div
            className="bg-[#f3e9f8] rounded-xl p-lg lg:p-xl border border-outline-variant/20 flex flex-col h-full"
            style={{ boxShadow: '0px 4px 20px rgba(94,54,112,0.08)' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between mb-xl">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-[#874f9e] scale-125">settings</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Account Settings</h2>
              </div>

              {/* Edit Profile button — only shown when NOT in edit mode */}
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="inline-flex items-center gap-xs px-lg py-2.5 bg-[#874f9e] text-white font-label-md rounded-lg hover:bg-[#5e3670] active:scale-95 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Edit Profile
                </button>
              )}
            </div>

            {/* ── Success banner ─────────────────────────────── */}
            {saveSuccess && (
              <div className="mb-lg flex items-center gap-sm bg-green-50 border border-green-300 text-green-800 px-lg py-md rounded-lg">
                <span className="material-symbols-outlined text-green-600 text-[20px]">check_circle</span>
                <span className="font-label-md">Profile updated successfully.</span>
              </div>
            )}

            {/* ── Error banner ───────────────────────────────── */}
            {saveError && (
              <div className="mb-lg flex items-center gap-sm bg-red-50 border border-red-300 text-red-800 px-lg py-md rounded-lg">
                <span className="material-symbols-outlined text-red-600 text-[20px]">error</span>
                <span className="font-label-md">{saveError}</span>
              </div>
            )}

            <form className="space-y-xl flex-grow" onSubmit={handleSave} noValidate>
              {/* ── Email (always read-only) ──────────────────── */}
              <div className="space-y-sm">
                <span className="block font-label-md text-label-md text-[#5e3670]">Email Address</span>
                <div className="w-full bg-white/60 border border-[#b98ecf] rounded-lg py-3 px-md text-on-surface font-body-md select-none flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[16px] text-outline">mail</span>
                  {user?.email}
                </div>
                <p className="text-[#874f9e] font-label-sm uppercase tracking-wider text-[10px]">Cannot be changed</p>
              </div>

              {/* ── Full Name ─────────────────────────────────── */}
              <div className="space-y-sm">
                <label className="block font-label-md text-label-md text-[#5e3670]" htmlFor="profile-fullname">
                  Full Name
                </label>
                {isEditing ? (
                  <div className="relative max-w-lg">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">person</span>
                    <input
                      id="profile-fullname"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full bg-white border border-[#874f9e] rounded-lg py-3 pl-10 pr-md focus:ring-2 focus:ring-[#874f9e] focus:border-[#874f9e] outline-none transition-all text-on-surface"
                      autoComplete="name"
                    />
                  </div>
                ) : (
                  <div className="w-full bg-white/60 border border-[#b98ecf] rounded-lg py-3 px-md text-on-surface font-body-md flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[16px] text-outline">person</span>
                    {user?.full_name || <span className="text-outline italic">Not set</span>}
                  </div>
                )}
              </div>

              {/* ── Mobile Number ────────────────────────────── */}
              <div className="space-y-sm">
                <label className="block font-label-md text-label-md text-[#5e3670]" htmlFor="profile-mobile">
                  Mobile Number
                </label>
                {isEditing ? (
                  <div className="relative max-w-lg">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">phone</span>
                    <input
                      id="profile-mobile"
                      type="tel"
                      value={editMobile}
                      onChange={(e) => setEditMobile(e.target.value)}
                      placeholder="Enter your mobile number"
                      className="w-full bg-white border border-[#874f9e] rounded-lg py-3 pl-10 pr-md focus:ring-2 focus:ring-[#874f9e] focus:border-[#874f9e] outline-none transition-all text-on-surface"
                      autoComplete="tel"
                    />
                  </div>
                ) : (
                  <div className="w-full bg-white/60 border border-[#b98ecf] rounded-lg py-3 px-md text-on-surface font-body-md flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[16px] text-outline">phone</span>
                    {user?.mobile || <span className="text-outline italic">Not set</span>}
                  </div>
                )}
              </div>

              {/* ── Member Since ─────────────────────────────── */}
              {user?.created_at && (
                <div className="space-y-sm">
                  <span className="block font-label-md text-label-md text-[#5e3670]">Member Since</span>
                  <div className="w-full bg-white/60 border border-[#b98ecf] rounded-lg py-3 px-md text-on-surface font-body-md flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[16px] text-outline">calendar_today</span>
                    {new Date(user.created_at).toLocaleDateString('en-IN', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </div>
                </div>
              )}

              {/* ── Save / Cancel buttons — ONLY in edit mode ── */}
              {isEditing && (
                <div className="flex flex-col sm:flex-row gap-lg pt-lg border-t border-[#d4aae8]/40 mt-auto">
                  {/* Save Changes */}
                  <button
                    id="save-profile-btn"
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 sm:flex-none sm:min-w-[180px] inline-flex items-center justify-center gap-sm py-3.5 px-lg bg-[#874f9e] text-white font-label-md rounded-lg hover:bg-[#5e3670] active:scale-95 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <span className="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
                        Saving…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px]">save</span>
                        Save Changes
                      </>
                    )}
                  </button>

                  {/* Cancel */}
                  <button
                    id="cancel-profile-btn"
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex-1 sm:flex-none sm:min-w-[120px] inline-flex items-center justify-center gap-sm py-3.5 px-lg border-2 border-[#874f9e] text-[#874f9e] font-label-md rounded-lg hover:bg-white/60 active:scale-95 transition-all disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>
        </section>

      </div>
    </main>
  );
}
