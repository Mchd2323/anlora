import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { apiFetch, storeSession, clearSession } from '../utils/authClient';
import { hasRemoteApi } from '../config/api';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  CloudCheck,
  ShieldCheck,
  Lock,
  Mail,
  X,
  Loader2,
  LogOut,
  MapPin,
  Globe,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { BRAND } from '../config/brand';
import { COUNTRIES, TURKISH_CITIES, filterTurkishCities } from '../data/locations';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onSyncNow: () => Promise<void>;
  onMigrateGuestProgress?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  onSyncNow,
  onMigrateGuestProgress
}) => {
  // Step manager: 'main' | 'email_form' | 'verify_email' | 'guest_migration'
  const [authStep, setAuthStep] = useState<'main' | 'email_form' | 'verify_email' | 'guest_migration'>('main');
  const [isRegisterMode, setIsRegisterMode] = useState(true);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('Türkiye');
  const [city, setCity] = useState('İstanbul');
  const [citySearch, setCitySearch] = useState('');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // Anti-bot honeypot field

  // Verification Code state
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devCodePreview, setDevCodePreview] = useState<string | null>(null);

  /*
   * Sunucu bu kurulumda var mı?
   *
   * Hesap, doğrulama kodu ve bulut yedeği sunucu ister. APK çevrimdışı
   * derlendiğinde sunucu adresi tanımlı olmaz; kullanıcıya formu doldurtup
   * sonunda hata göstermek yerine durumu baştan söylemek gerekir. `null`
   * "henüz bakılmadı" demektir.
   */
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    hasRemoteApi().then(ok => {
      if (!cancelled) setServerAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Reset states when opening modal
  useEffect(() => {
    if (isOpen) {
      if (profile.isLoggedIn) {
        setAuthStep('main');
      } else {
        setAuthStep('main');
      }
      setError('');
      setMessage('');
      setDevCodePreview(null);
    }
  }, [isOpen, profile.isLoggedIn]);

  // Resend code timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const filteredCities = useMemo(() => {
    return filterTurkishCities(citySearch);
  }, [citySearch]);

  const modalRef = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  // 1. Google ile giriş
  //
  // Önceki sürümde bu düğme gerçek bir Google akışı çalıştırmıyordu: istemci
  // `user.<rastgele4hane>@gmail.com` biçiminde bir adres uyduruyor, sunucu da
  // bunu doğrulamadan kabul ediyordu. Kullanıcı "Google ile giriş yaptım"
  // sanıyor, aslında her seferinde rastgele yeni bir hesap açılıyor ve önceki
  // verisine bir daha ulaşamıyordu. Gerçek akış bir Google kimlik jetonu
  // gerektirir; jeton olmadan düğme dürüstçe devre dışıdır.
  const handleGoogleAuth = async (credential?: string) => {
    if (!credential) {
      setError(
        'Google ile giriş bu kurulumda henüz etkin değil. Lütfen e-posta ve parolanızla devam edin.'
      );
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await apiFetch('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential })
      });

      storeSession(data.token, data.expiresAt);
      onUpdateProfile({
        email: data.user.email,
        name: data.user.name,
        country: data.user.country,
        city: data.user.city,
        emailVerified: true,
        authProvider: 'google',
        isAdmin: !!data.user.isAdmin,
        isLoggedIn: true,
        lastSyncTime: new Date().toLocaleTimeString('tr-TR')
      });
      setAuthStep('guest_migration');
    } catch (err: any) {
      setError(err.message || 'Google ile giriş yapılamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Email Register / Login Submit
  const handleEmailFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Lütfen e-posta ve parolanızı girin.');
      return;
    }

    if (isRegisterMode && password.length < 8) {
      setError('Parola en az 8 karakter olmalıdır.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      if (isRegisterMode) {
        // Register API call with anti-bot honeypot
        const data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim() || email.split('@')[0],
            email: email.trim(),
            password,
            country,
            city,
            hp_website: honeypot // Anti-bot honeypot
          })
        });

        if (data.devCode) {
          setDevCodePreview(data.devCode);
        }

        setResendCooldown(60);
        setMessage('Doğrulama kodu e-postana gönderildi.');
        setAuthStep('verify_email');
      } else {
        // Login API call
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password
          })
        });

        storeSession(data.token, data.expiresAt);

        const newProfile: UserProfile = {
          email: data.user.email,
          name: data.user.name,
          country: data.user.country,
          city: data.user.city,
          emailVerified: data.user.emailVerified,
          authProvider: 'email',
          isAdmin: !!data.user.isAdmin,
          isLoggedIn: true,
          lastSyncTime: new Date().toLocaleTimeString('tr-TR')
        };

        onUpdateProfile(newProfile);
        setMessage('Giriş başarılı!');
        setAuthStep('guest_migration');
      }
    } catch (err: any) {
      setError(err.message || 'İşlem gerçekleştirilemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Verify 6-digit Email Code
  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim() || verificationCode.trim().length < 6) {
      setError('Lütfen 6 haneli doğrulama kodunu eksiksiz girin.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          code: verificationCode.trim()
        })
      });

      storeSession(data.token, data.expiresAt);

      const newProfile: UserProfile = {
        email: data.user.email,
        name: data.user.name,
        country: data.user.country,
        city: data.user.city,
        emailVerified: true,
        authProvider: 'email',
        isAdmin: !!data.user.isAdmin,
        isLoggedIn: true,
        lastSyncTime: new Date().toLocaleTimeString('tr-TR')
      };

      onUpdateProfile(newProfile);
      setMessage('E-posta adresin başarıyla doğrulandı!');
      setAuthStep('guest_migration');
    } catch (err: any) {
      setError(err.message || 'Kod doğrulanamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Resend Code Handler
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError('');

    try {
      const data = await apiFetch('/api/auth/resend-code', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() })
      });

      if (data.devCode) {
        setDevCodePreview(data.devCode);
      }

      setResendCooldown(60);
      setMessage('Yeni doğrulama kodu gönderildi.');
    } catch (err: any) {
      setError(err.message || 'Kod gönderilemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Logout Handler
  const handleLogout = () => {
    clearSession();
    onUpdateProfile({
      email: null,
      name: 'Misafir Kullanıcı',
      isLoggedIn: false
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        className="bg-[#FFFFFF] rounded-2xl max-w-md w-full p-6 sm:p-7 border border-[#E4E1D9] shadow-xl relative space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#8E95A2] hover:text-[#1E2430] rounded-xl hover:bg-[#F1EFE8] transition-colors cursor-pointer"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/*
          Sunucu yoksa bunu baştan söyle. Formu doldurup sonunda hata almak,
          kullanıcıya kendi hatasıymış gibi görünür; oysa bu sürüm bilerek
          çevrimdışı derlenmiş olabilir.
        */}
        {serverAvailable === false && !profile.isLoggedIn && (
          <div className="p-3.5 rounded-xl bg-[#FBF1DE] border border-[#E7C98F] text-[11px] leading-relaxed text-[#8A5A18]">
            <b>Bu sürümde hesap özelliği kapalı.</b> Uygulama tamamen
            çevrimdışı çalışıyor: kelimelerin, setlerin ve ilerlemen zaten
            telefonunda saklanıyor ve hiçbir yere gönderilmiyor. Hesap yalnızca
            bulut yedeği içindir; sunucu adresi tanımlı olmadığı için giriş ve
            kayıt şu an çalışmaz.
          </div>
        )}

        {/* LOGGED-IN PROFILE VIEW */}
        {profile.isLoggedIn && authStep !== 'guest_migration' ? (
          <div className="space-y-5 text-center pt-2">
            <div className="w-14 h-14 rounded-2xl bg-[#E9F3ED] text-[#4F806A] flex items-center justify-center mx-auto border border-[#BFD7C8]">
              <CloudCheck className="w-7 h-7" />
            </div>

            <div>
              <h3 id="anlora-auth-modal-title" className="text-lg font-bold text-[#1E2430]">
                {profile.name || 'Anlora Üyesi'}
              </h3>
              <p className="text-xs text-[#687080] mt-0.5">{profile.email}</p>
              {profile.city && (
                <p className="text-xs text-[#8E95A2] flex items-center justify-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#4F46A5]" />
                  <span>{profile.city}, {profile.country || 'Türkiye'}</span>
                </p>
              )}
            </div>

            <div className="bg-[#E9F3ED] p-3.5 rounded-xl border border-[#BFD7C8] text-left text-xs space-y-1 text-[#35654E]">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#4F806A]" /> Hesabın Güvende
              </p>
              <p className="text-[11px] text-[#35654E]">
                Kendi Kelime Setlerin, Oxford ilerlemen ve favori kelimelerin güvenli şekilde hesabına eşitlenmektedir.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={onSyncNow}
                className="w-full py-2.5 bg-[#4F46A5] hover:bg-[#433B91] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Verileri Şimdi Eşitle
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 bg-[#F8F7F3] hover:bg-[#FAECEA] hover:text-[#C65D55] text-[#1E2430] font-semibold text-xs rounded-xl border border-[#E4E1D9] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Çıkış Yap</span>
              </button>
            </div>
          </div>
        ) : authStep === 'guest_migration' ? (
          /* GUEST PROGRESS MIGRATION PROMPT */
          <div className="space-y-4 text-center pt-2">
            <div className="w-13 h-13 rounded-2xl bg-[#EEECFA] text-[#4F46A5] flex items-center justify-center mx-auto border border-[#D7D2F4]">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#1E2430]">
                İlerlemeni Aktaralım mı?
              </h3>
              <p className="text-xs text-[#687080] leading-relaxed">
                Bu cihazdaki Oxford çalışma ilerlemeni ve favorilerini yeni hesabına bağlayabilirsin.
              </p>
            </div>

            <div className="p-3 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9] text-xs text-left text-[#687080] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#1E2430]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4F806A]" /> Oxford 3000 İlerlemesi
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-[#1E2430]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4F806A]" /> Öğrenilen & Öğrenilen Kelimeler
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-[#1E2430]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4F806A]" /> Favori Kelimeler
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  if (onMigrateGuestProgress) onMigrateGuestProgress();
                  onClose();
                }}
                className="w-full py-2.5 bg-[#4F46A5] hover:bg-[#433B91] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                İlerlememi Hesabıma Aktar
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-xs font-semibold text-[#8E95A2] hover:text-[#1E2430] transition-colors cursor-pointer"
              >
                Şimdilik Değil, Devam Et
              </button>
            </div>
          </div>
        ) : authStep === 'verify_email' ? (
          /* EMAIL VERIFICATION STEP */
          <div className="space-y-4">
            <button
              onClick={() => setAuthStep('email_form')}
              className="flex items-center gap-1 text-xs text-[#687080] hover:text-[#1E2430] font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Geri Dön</span>
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-[#EEECFA] text-[#4F46A5] flex items-center justify-center mx-auto border border-[#D7D2F4]">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#1E2430]">
                E-postanı Doğrula
              </h3>
              <p className="text-xs text-[#687080]">
                <span className="font-semibold text-[#1E2430]">{email}</span> adresine 6 haneli doğrulama kodu gönderdik.
              </p>
            </div>

            {devCodePreview && (
              <div className="p-2.5 bg-[#FBF1DE] rounded-xl border border-[#E7C98F] text-[11px] text-[#8A5A18] text-center font-mono font-bold">
                Doğrulama Kodu: {devCodePreview}
              </div>
            )}

            {error && (
              <div className="p-3 bg-[#FAECEA] rounded-xl border border-[#E8C2BD] text-xs text-[#C65D55] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {message && !error && (
              <div className="p-3 bg-[#E9F3ED] rounded-xl border border-[#BFD7C8] text-xs text-[#35654E] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleVerifyCodeSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#687080] uppercase mb-1">
                  6 Haneli Kod
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.4em] font-mono text-lg py-2.5 bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-bold text-[#1E2430]"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || verificationCode.length < 6}
                className="w-full py-2.5 bg-[#4F46A5] hover:bg-[#433B91] disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Doğrulanıyor...</span>
                  </>
                ) : (
                  <span>Kodu Doğrula ve Devam Et</span>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-xs font-semibold text-[#4F46A5] hover:text-[#433B91] disabled:text-[#8E95A2] transition-colors cursor-pointer"
                >
                  {resendCooldown > 0
                    ? `Kodu Tekrar Gönder (${resendCooldown}s)`
                    : 'Kodu Tekrar Gönder'}
                </button>
              </div>
            </form>
          </div>
        ) : authStep === 'email_form' ? (
          /* EMAIL & PASSWORD FORM (REGISTER / LOGIN) */
          <div className="space-y-3.5">
            <button
              onClick={() => setAuthStep('main')}
              className="flex items-center gap-1 text-xs text-[#687080] hover:text-[#1E2430] font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Geri Dön</span>
            </button>

            {/* Mode switch */}
            <div className="flex p-1 bg-[#F8F7F3] rounded-xl border border-[#E4E1D9]">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(true);
                  setError('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  isRegisterMode
                    ? 'bg-[#FFFFFF] text-[#1E2430] shadow-xs'
                    : 'text-[#687080] hover:text-[#1E2430]'
                }`}
              >
                Hesap Oluştur
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setError('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  !isRegisterMode
                    ? 'bg-[#FFFFFF] text-[#1E2430] shadow-xs'
                    : 'text-[#687080] hover:text-[#1E2430]'
                }`}
              >
                Giriş Yap
              </button>
            </div>

            {error && (
              <div className="p-3 bg-[#FAECEA] rounded-xl border border-[#E8C2BD] text-xs text-[#C65D55] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEmailFormSubmit} className="space-y-3">
              {/* Anti-bot honeypot field - hidden from humans */}
              <div style={{ display: 'none' }} aria-hidden="true">
                <label>Website</label>
                <input
                  type="text"
                  name="hp_website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {isRegisterMode && (
                <div>
                  <label className="block text-[11px] font-bold text-[#687080] uppercase mb-1">
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Adınız"
                    className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-semibold text-[#1E2430]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-[#687080] uppercase mb-1">
                  E-posta Adresi
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E95A2] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-semibold text-[#1E2430]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#687080] uppercase mb-1">
                  Şifre {isRegisterMode && <span className="text-[#8E95A2] font-normal">(en az 8 karakter)</span>}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8E95A2] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-semibold text-[#1E2430]"
                  />
                </div>
              </div>

              {/* Geographic location fields during registration */}
              {isRegisterMode && (
                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  {/* Country */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#687080] uppercase mb-1">
                      Ülke
                    </label>
                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 text-[#8E95A2] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full pl-8 pr-2 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-semibold text-[#1E2430] appearance-none"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 81 Turkish Cities Searchable Dropdown */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-[#687080] uppercase mb-1">
                      Şehir (81 İl)
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                      className="w-full flex items-center justify-between px-2.5 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-[#FFFFFF] focus:outline-none focus:border-[#4F46A5] font-semibold text-[#1E2430] text-left cursor-pointer"
                    >
                      <span className="truncate">{city}</span>
                      <MapPin className="w-3.5 h-3.5 text-[#8E95A2] shrink-0" />
                    </button>

                    {isCityDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-[#FFFFFF] rounded-xl border border-[#E4E1D9] shadow-lg z-30 p-2 space-y-1.5">
                        <div className="relative">
                          <Search className="w-3 h-3 text-[#8E95A2] absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="İl ara (örn. Elazığ, İzmir)..."
                            value={citySearch}
                            onChange={(e) => setCitySearch(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-lg focus:outline-none font-medium text-[#1E2430]"
                          />
                        </div>

                        <div className="max-h-36 overflow-y-auto space-y-0.5">
                          {filteredCities.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setCity(c);
                                setIsCityDropdownOpen(false);
                                setCitySearch('');
                              }}
                              className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                                city === c
                                  ? 'bg-[#EEECFA] text-[#4F46A5] font-bold'
                                  : 'text-[#1E2430] hover:bg-[#F8F7F3]'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 bg-[#4F46A5] hover:bg-[#433B91] disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Lütfen bekleyin...</span>
                  </>
                ) : (
                  <span>{isRegisterMode ? 'Kayıt Ol ve Devam Et' : 'Giriş Yap'}</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* PRIMARY AUTH MODAL (MAIN VIEW) */
          <div className="space-y-4">
            <div className="space-y-1.5 text-center pb-1">
              <div className="text-2xl font-black text-[#1E2430] tracking-tight">
                {BRAND.name}
              </div>
              <div className="text-xs font-semibold text-[#4F46A5]">
                {BRAND.slogan}
              </div>
              <p className="text-xs text-[#687080] pt-1">
                Kendi Kelime Setlerini oluşturmak ve ilerlemeni kaydetmek için giriş yap.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-[#FAECEA] rounded-xl border border-[#E8C2BD] text-xs text-[#C65D55] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              {/* Google Button */}
              <button
                type="button"
                onClick={() => handleGoogleAuth()}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#FFFFFF] hover:bg-[#F8F7F3] text-[#1E2430] font-semibold text-xs rounded-xl border border-[#E4E1D9] shadow-2xs transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google ile Devam Et</span>
              </button>

              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-[#EFECE6]" />
                <span className="text-[11px] font-semibold text-[#8E95A2] uppercase">veya</span>
                <div className="flex-1 h-px bg-[#EFECE6]" />
              </div>

              {/* Email Form Trigger */}
              <button
                onClick={() => {
                  setIsRegisterMode(true);
                  setAuthStep('email_form');
                }}
                className="w-full py-2.5 px-4 bg-[#4F46A5] hover:bg-[#433B91] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>E-posta ile Hesap Oluştur</span>
              </button>

              <button
                onClick={() => {
                  setIsRegisterMode(false);
                  setAuthStep('email_form');
                }}
                className="w-full py-2 text-xs font-semibold text-[#687080] hover:text-[#1E2430] transition-colors text-center cursor-pointer"
              >
                Zaten hesabın var mı? <span className="text-[#4F46A5] underline font-bold">Giriş Yap</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
