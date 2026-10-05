import { Background, Title } from 'animal-island-ui'
import { NavLink, Outlet } from 'react-router'

import { useAnimalese } from './animalese'

const links = [
  { to: '/', label: '说话', icon: 'M4 5h16v10H9l-5 4z' },
  { to: '/inventory', label: '词表', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { to: '/pipeline', label: '原理', icon: 'M5 6h4v4H5zM15 14h4v4h-4zM9 8h6v8' },
]

export function Layout() {
  const { error } = useAnimalese()
  return (
    <Background type="default" className="page">
      <header className="header">
        <div className="brand">
          <Title size="large" color="app-green">Animalese</Title>
        </div>
        <nav className="nav" aria-label="页面">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={link.icon} /></svg>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        {error && (
          <p className="banner error">
            声库加载失败：
            {error}
          </p>
        )}
        <Outlet />
      </main>
    </Background>
  )
}
