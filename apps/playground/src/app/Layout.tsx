import type { Locale } from './i18n'

import { Background, Title } from 'animal-island-ui'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

import { useAnimalese } from './animalese'
import { setLocale } from './i18n'

const links = [
  { to: '/', label: 'nav.speak', icon: 'M4 5h16v10H9l-5 4z' },
  { to: '/live', label: 'nav.live', icon: 'M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v3' },
  { to: '/inventory', label: 'nav.inventory', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { to: '/pipeline', label: 'nav.pipeline', icon: 'M5 6h4v4H5zM15 14h4v4h-4zM9 8h6v8' },
]

export function Layout() {
  const { error } = useAnimalese()
  const { t, i18n } = useTranslation()
  return (
    <Background type="default" className="page">
      <header className="header">
        <div className="brand">
          <Title size="large" color="app-green">Animalese</Title>
        </div>
        <nav className="nav" aria-label={t('nav.pages')}>
          {links.map(link => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={link.icon} /></svg>
              <span>{t(link.label)}</span>
            </NavLink>
          ))}
        </nav>
        <label className="locale-picker">
          <span className="sr-only">{t('nav.language')}</span>
          <select aria-label={t('nav.language')} value={i18n.resolvedLanguage} onChange={event => setLocale(event.target.value as Locale)}>
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <main className="content">
        {error && (
          <p className="banner error">
            {t('layout.bankLoadError')}
            {error}
          </p>
        )}
        <Outlet />
      </main>
    </Background>
  )
}
