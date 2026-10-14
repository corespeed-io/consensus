import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useI18n } from './i18n';

/** Light and dark. Stored ids stay 'day' and 'night' so the original stylesheet's selectors still apply. */
export type Theme = 'day' | 'night';
const THEMES: { id: Theme; key: 'theme_light' | 'theme_dark'; Icon: typeof Sun }[] = [
  { id: 'day', key: 'theme_light', Icon: Sun },
  { id: 'night', key: 'theme_dark', Icon: Moon },
];
const META_COLOR: Record<Theme, string> = { day: '#ffffff', night: '#000000' };
export const THEME_KEY = 'consensus.theme';

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: 'day', setTheme: () => {} });

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY) ?? localStorage.getItem('cs_theme');
    if (t === 'night') return 'night';
    if (t === 'day' || t === 'sunset') return 'day';
  } catch {
    /* storage blocked: follow the system */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);
  }, [theme]);
  const choose = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* the choice lasts until the page closes */
    }
  };
  return <Ctx.Provider value={{ theme, setTheme: choose }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  return (
    <div className="theme-switch" role="radiogroup" aria-label={t('theme')}>
      {THEMES.map(({ id, key, Icon }) => (
        <button key={id} type="button" role="radio" aria-checked={theme === id} className={theme === id ? 'on' : ''} onClick={() => setTheme(id)} data-tip={t(key)} aria-label={t(key)}>
          <Icon size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
