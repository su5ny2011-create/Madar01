import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X, CheckCircle2 } from 'lucide-react';
import type { Language } from '../types';
import { AlMadarLogo } from './AlMadarLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

interface PWAInstallButtonProps {
  lang: Language;
  variant?: 'header' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang,
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={
          variant === 'header'
            ? 'min-h-[44px] px-3.5 py-2 rounded-xl bg-[#E58E26] hover:bg-[#d17d1b] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer'
            : 'min-h-[48px] w-full px-4 py-2.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer'
        }
        aria-label={lang === 'ar' ? 'تثبيت تطبيق المدار PWA' : 'Install Al-Madar PWA App'}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>
          {lang === 'ar' ? 'تثبيت البرنامج (PWA)' : 'Install App (PWA)'}
        </span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <AlMadarLogo size="sm" showText={false} />
                <div>
                  <h3 id="pwa-guide-title" className="text-base font-bold text-slate-900">
                    {lang === 'ar'
                      ? 'تثبيت برنامج شركة المدار (PWA)'
                      : 'Install Al-Madar IT App (PWA)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === 'ar'
                      ? 'يعمل بشعار شركة المدار على سطح المكتب والهاتف'
                      : 'Runs with the Al-Madar icon on desktop & mobile'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 font-bold text-[#0B3B68] mb-1">
                  <Smartphone className="w-4 h-4 text-[#E58E26]" />
                  <span>
                    {isIOS
                      ? lang === 'ar'
                        ? 'على أجهزة iPhone و iPad (Safari):'
                        : 'On iPhone / iPad (Safari):'
                      : lang === 'ar'
                      ? 'خطوات التثبيت السريع:'
                      : 'Quick Installation Steps:'}
                  </span>
                </div>
                {isIOS ? (
                  <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-slate-600">
                    <li>
                      {lang === 'ar'
                        ? 'اضغط على زر المشاركة (Share) في متصفح سفاري.'
                        : 'Tap the Share button in the Safari toolbar.'}
                    </li>
                    <li>
                      {lang === 'ar'
                        ? 'اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                        : 'Select "Add to Home Screen".'}
                    </li>
                    <li>
                      {lang === 'ar'
                        ? 'سيظهر البرنامج بنفس شعار وألوان شركة المدار.'
                        : 'The app will appear with the Al-Madar logo and colors.'}
                    </li>
                  </ol>
                ) : (
                  <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-slate-600">
                    <li>
                      {lang === 'ar'
                        ? 'من شريط العنوان في المتصفح (Chrome / Edge)، اضغط على أيقونة تثبيت التطبيق بجانب الرابط.'
                        : 'In Chrome/Edge address bar, click the Install App icon or browser menu.'}
                    </li>
                    <li>
                      {lang === 'ar'
                        ? 'أو من قائمة المتصفح اختر "تثبيت التطبيق / Install App".'
                        : 'Or open the browser menu and tap "Install App / Add to Home Screen".'}
                    </li>
                    <li>
                      {lang === 'ar'
                        ? 'سيتم تثبيت البرنامج بأيقونة شعار شركة المدار ويعمل بكفاءة عالية على الشاشات اللمسية.'
                        : 'The app installs with the Al-Madar logo and works offline & on touch screens.'}
                    </li>
                  </ol>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-[#1E824C] font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? 'يدعم العمل بدون إنترنت (Offline) والشاشات اللمسية بكفاءة عالية.'
                    : 'Supports offline caching and responsive touchscreen navigation.'}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] w-full rounded-xl bg-[#0B3B68] text-white font-bold text-sm hover:bg-[#155E95] transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'حسناً، فهمت' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC<{ lang: Language }> = ({ lang }) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        {lang === 'ar'
          ? 'وضع عدم الاتصال — يتم استخدام البيانات المحفوظة محلياً'
          : 'Offline Mode — Using locally saved data'}
      </span>
    </div>
  );
};
