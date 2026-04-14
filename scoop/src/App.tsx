import { useState } from 'react'
import { SettingsModal } from './components/SettingsModal'
import { getJoinCodeFromLocation } from './lib/roomSession'
import { Home } from './screens/Home'
import { LocalBattle } from './screens/LocalBattle'
import { OnlineBattle } from './screens/OnlineBattle'
import { SoloGame } from './screens/SoloGame'
import type { Screen } from './types'

function initialScreen(): Screen {
  if (typeof window !== 'undefined' && getJoinCodeFromLocation()) return 'online'
  return 'home'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)

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
