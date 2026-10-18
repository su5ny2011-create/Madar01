import React from 'react';

interface AlMadarLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'default' | 'light';
  className?: string;
}

export const AlMadarLogo: React.FC<AlMadarLogoProps> = ({
  size = 'md',
  showText = true,
  variant = 'default',
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const blueId = `madarBlue-${uid}`;
  const goldId = `madarGold-${uid}`;
  const greenId = `madarGreen-${uid}`;

  const iconDimensions = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
  }[size];

  const isLight = variant === 'light';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div className={`relative shrink-0 ${iconDimensions}`}>
        <svg
          viewBox="0 0 360 320"
          className="w-full h-full drop-shadow-sm"
          role="img"
          aria-label="شعار شركة المدار لتجارة تكنولوجيا المعلومات - Al-Madar IT Logo"
        >
          <defs>
            <linearGradient id={blueId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0B3B68" />
              <stop offset="55%" stopColor="#155E95" />
              <stop offset="100%" stopColor="#2980B9" />
            </linearGradient>
            <linearGradient id={goldId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B45309" />
              <stop offset="50%" stopColor="#E58E26" />
              <stop offset="100%" stopColor="#F6B93B" />
            </linearGradient>
            <linearGradient id={greenId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#145A32" />
              <stop offset="50%" stopColor="#1E824C" />
              <stop offset="100%" stopColor="#2ECC71" />
            </linearGradient>
          </defs>

          {/* Outer Dotted Tech Orbit */}
          <ellipse
            cx="166"
            cy="168"
            rx="132"
            ry="84"
            transform="rotate(-32 166 168)"
            fill="none"
            stroke={isLight ? '#93C5FD' : '#0B3B68'}
            strokeWidth="3"
            strokeDasharray="5 5"
            opacity="0.65"
          />

          {/* Blue Binary Ring */}
          <ellipse
            cx="168"
            cy="164"
            rx="102"
            ry="62"
            transform="rotate(-58 168 164)"
            fill="none"
            stroke={`url(#${blueId})`}
            strokeWidth="20"
          />

          {/* Gold Binary Ring */}
          <ellipse
            cx="160"
            cy="162"
            rx="98"
            ry="58"
            transform="rotate(34 160 162)"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="18"
          />

          {/* Green Binary Ring */}
          <ellipse
            cx="172"
            cy="176"
            rx="108"
            ry="50"
            transform="rotate(-14 172 176)"
            fill="none"
            stroke={`url(#${greenId})`}
            strokeWidth="16"
          />

          {/* Central Circuit Lightbulb */}
          <circle
            cx="166"
            cy="164"
            r="38"
            fill="#FFFFFF"
            stroke={`url(#${greenId})`}
            strokeWidth="4.5"
          />
          <path
            d="M152 158 C152 147 158 140 166 140 C174 140 180 147 180 158 C180 164 176 169 173 174 L159 174 C156 169 152 164 152 158 Z"
            fill="none"
            stroke={`url(#${greenId})`}
            strokeWidth="3.5"
          />
          {/* Circuit Traces inside Bulb */}
          <line x1="160" y1="174" x2="160" y2="157" stroke="#1E824C" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="160" cy="154" r="3" fill="#E58E26" />
          <line x1="166" y1="174" x2="166" y2="150" stroke="#0B3B68" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="166" cy="147" r="3" fill="#0B3B68" />
          <line x1="172" y1="174" x2="172" y2="159" stroke="#1E824C" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="172" cy="156" r="3" fill="#2ECC71" />
          <line x1="158" y1="180" x2="174" y2="180" stroke="#0B3B68" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="161" y1="185" x2="171" y2="185" stroke="#E58E26" strokeWidth="3.5" strokeLinecap="round" />

          {/* Three Dynamic Rising Arrows */}
          {/* Blue Arrow */}
          <path
            d="M104 214 Q168 164 246 72"
            fill="none"
            stroke={`url(#${blueId})`}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <polygon points="262,54 228,69 253,88" fill={`url(#${blueId})`} />

          {/* Gold Arrow */}
          <path
            d="M82 246 Q184 184 288 60"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="14"
            strokeLinecap="round"
          />
          <polygon points="308,38 268,56 296,81" fill={`url(#${goldId})`} />

          {/* Green Arrow */}
          <path
            d="M68 268 Q192 216 294 104"
            fill="none"
            stroke={`url(#${greenId})`}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <polygon points="312,85 276,100 300,122" fill={`url(#${greenId})`} />

          {/* Binary Code Accents */}
          <text x="122" y="106" fill="#FFFFFF" fontFamily="monospace" fontSize="9" fontWeight="bold" transform="rotate(-38 122 106)">
            1010110
          </text>
          <text x="95" y="172" fill="#FFFFFF" fontFamily="monospace" fontSize="9" fontWeight="bold" transform="rotate(34 95 172)">
            1011010
          </text>
          <text x="172" y="234" fill="#FFFFFF" fontFamily="monospace" fontSize="9" fontWeight="bold" transform="rotate(-15 172 234)">
            0110101
          </text>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-snug min-w-0">
          <span
            className={`font-extrabold tracking-tight ${
              size === 'xl'
                ? 'text-xl sm:text-2xl'
                : size === 'lg'
                ? 'text-lg sm:text-xl'
                : 'text-sm sm:text-base'
            } ${isLight ? 'text-white' : 'text-[#0B3B68]'}`}
          >
            شركة المدار لتجارة تكنولوجيا المعلومات
          </span>
          <span
            dir="ltr"
            className={`font-bold ${
              size === 'xl' || size === 'lg' ? 'text-xs mt-1' : 'text-[10px] mt-0.5'
            } ${isLight ? 'text-amber-300' : 'text-[#E58E26]'} leading-tight`}
          >
            Al-Madar Information Technology Trading Company
          </span>
        </div>
      )}
    </div>
  );
};
