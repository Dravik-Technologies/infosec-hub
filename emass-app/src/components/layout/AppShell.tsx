import { Outlet, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import { useSystemStore } from '@/store/systemStore'
import { useSCTMStore } from '@/store/sctmStore'
import { usePOAMStore } from '@/store/poamStore'
import { useVulnStore } from '@/store/vulnStore'

export default function AppShell() {
  const { systemId } = useParams<{ systemId: string }>()
  const setActiveSystem = useSystemStore((s) => s.setActiveSystem)
  const fetchSystems = useSystemStore((s) => s.fetchSystems)
  const systems = useSystemStore((s) => s.systems)
  const fetchSCTM = useSCTMStore((s) => s.fetchEntriesForSystem)
  const fetchPOAM = usePOAMStore((s) => s.fetchItemsForSystem)
  const fetchVulns = useVulnStore((s) => s.fetchVulnsForSystem)

  useEffect(() => {
    if (systems.length === 0) fetchSystems()
  }, [])

  useEffect(() => {
    setActiveSystem(systemId ?? null)
    if (systemId) {
      fetchSCTM(systemId)
      fetchPOAM(systemId)
      fetchVulns(systemId)
    }
  }, [systemId, setActiveSystem])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
