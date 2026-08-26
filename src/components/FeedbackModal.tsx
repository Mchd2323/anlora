import React, { useState } from 'react';
import { MessageSquareWarning, X, Check, Loader2 } from 'lucide-react';
import { apiUrl } from '../config/api';
import { getSessionToken } from '../utils/authClient';
import { useModalA11y } from '../hooks/useModalA11y';

/**
 * Hata bildirimi ve iletişim.
 *
 * GİRİŞ ŞARTI YOK. Hata bildirmek için hesap açmak zorunda bırakmak,
 * bildirimlerin çoğunun hiç gelmemesi demektir. Giriş yapılmışsa hesabın
 * e-postası kayda eklenir; yapılmamışsa kullanıcı isterse yanıt adresi
 * bırakabilir.
 *
 * Kelime kartından açıldığında hangi kelime olduğu önceden doldurulur:
 * kullanıcı "hangi kelimeydi" diye geri dönmek zorunda kalmaz.
 */

export type FeedbackKind = 'word' | 'design' | 'bug' | 'idea' | 'other';

const KINDS: { id: FeedbackKind; label: string; hint: string }[] = [
  { id: 'word', label: 'Kelime hatası', hint: 'Anlam yanlış, örnek cümle hatalı, telaffuz yanlış' },
  { id: 'design', label: 'Tasarım', hint: 'Görünüm bozuk, yazı okunmuyor, buton çalışmıyor' },
  { id: 'bug', label: 'Hata', hint: 'Uygulama donuyor, veri kayboluyor' },
  { id: 'idea', label: 'Öneri', hint: 'Şu özellik olsa iyi olurdu' },
  { id: 'other', label: 'Diğer', hint: '' }
];

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kelime kartından açıldıysa hangi kelime. */
  initialWord?: string;
  initialKind?: FeedbackKind;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  initialWord,
  initialKind
}) => {
  const modalRef = useModalA11y(isOpen, onClose);
  const [kind, setKind] = useState<FeedbackKind>(initialKind || 'word');
  const [word, setWord] = useState(initialWord || '');
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Kart değişince alanlar o karta göre yeniden hazırlanır.
  React.useEffect(() => {
    if (!isOpen) return;
    setKind(initialKind || 'word');
    setWord(initialWord || '');
    setMessage('');
    setError('');
    setSent(false);
  }, [isOpen, initialWord, initialKind]);

  if (!isOpen) return null;

  const send = async () => {
    if (message.trim().length < 5) {
      setError('Lütfen sorunu birkaç kelimeyle anlat.');
      return;
    }

    setIsSending(true);
    setError('');
    try {
      const token = getSessionToken();
      const response = await fetch(apiUrl('/api/feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          kind,
          word: word.trim() || undefined,
          message: message.trim(),
          replyTo: replyTo.trim() || undefined,
          platform: navigator.userAgent.slice(0, 60),
          hp_website: honeypot
        })
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error(
          'Bildirim şu an gönderilemiyor. Bu sürüm çevrimdışı çalışıyor olabilir.'
        );
      }

      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Bildirim gönderilemedi.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="anlora-feedback-title"
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 py-8 bg-[#1E2430]/40 backdrop-blur-xs animate-fadeIn overflow-y-auto overscroll-contain"
    >
      <div className="bg-[#FFFFFF] rounded-2xl max-w-md w-full border border-[#E4E1D9] shadow-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3
            id="anlora-feedback-title"
            className="text-base font-bold text-[#1E2430] flex items-center gap-2"
          >
            <MessageSquareWarning className="w-4 h-4 text-[#4F46A5]" />
            Bize yaz
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8E95A2] hover:text-[#1E2430] rounded-lg cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E9F3ED] text-[#4F806A] flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E2430]">Bildirimin bize ulaştı.</p>
              <p className="text-xs text-[#687080] mt-1">
                Teşekkürler — hataları böyle buluyoruz.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#4F46A5] text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Kapat
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E95A2]">
                Ne hakkında?
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {KINDS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setKind(item.id)}
                    className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer text-left ${
                      kind === item.id
                        ? 'bg-[#EEECFA] border-[#4F46A5] text-[#4F46A5]'
                        : 'bg-[#F8F7F3] border-[#E4E1D9] text-[#1E2430] hover:bg-[#F1EFE8]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#8E95A2]">
                {KINDS.find(item => item.id === kind)?.hint}
              </p>
            </div>

            {kind === 'word' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E95A2] mb-1">
                  Hangi kelime?
                </label>
                <input
                  type="text"
                  value={word}
                  onChange={e => setWord(e.target.value)}
                  placeholder="Örn: wharf"
                  className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-white focus:outline-none focus:border-[#4F46A5] text-[#1E2430]"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E95A2] mb-1">
                Anlat
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder="Ne oldu, ne bekliyordun?"
                className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-white focus:outline-none focus:border-[#4F46A5] text-[#1E2430]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E95A2] mb-1">
                Yanıt istersen e-posta{' '}
                <span className="normal-case tracking-normal font-semibold text-[#8E95A2]">
                  (isteğe bağlı)
                </span>
              </label>
              <input
                type="email"
                value={replyTo}
                onChange={e => setReplyTo(e.target.value)}
                placeholder="ornek@eposta.com"
                className="w-full px-3 py-2 text-xs bg-[#F8F7F3] border border-[#E4E1D9] rounded-xl focus:bg-white focus:outline-none focus:border-[#4F46A5] text-[#1E2430]"
              />
            </div>

            {/* Bot tuzağı: insanlar bu alanı görmez, botlar doldurur. */}
            <input
              type="text"
              value={honeypot}
              onChange={e => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            {error && (
              <div className="p-3 rounded-xl bg-[#FAECEA] border border-[#F0CBC7] text-[11px] text-[#C65D55]">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#687080] hover:bg-[#F1EFE8] rounded-xl cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={isSending || message.trim().length < 5}
                className="px-5 py-2 bg-[#4F46A5] hover:bg-[#433B91] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {isSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Gönder
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
