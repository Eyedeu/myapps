import { useState } from 'react'
import { SettingsModal } from './components/SettingsModal'
import { Home } from './screens/Home'
import { LocalBattle } from './screens/LocalBattle'
import { OnlineBattle } from './screens/OnlineBattle'
import { SoloGame } from './screens/SoloGame'
import type { Screen } from './types'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')

  return (
    <>
      {screen === 'home' && <Home onNavigate={setScreen} />}
      {screen === 'solo' && <SoloGame onBack={() => setScreen('home')} />}
      {screen === 'online' && <OnlineBattle onBack={() => setScreen('home')} />}
      {screen === 'local' && <LocalBattle onBack={() => setScreen('home')} />}
      <SettingsModal />
    </>
  )
}
