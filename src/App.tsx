import { useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { NavLink, Navigate, Route, Routes } from "react-router-dom"
import MainPage from "@/pages/MainPage"
import PriceSettingsPage from "@/pages/PriceSettingsPage"
import RoomSettingsPage from "@/pages/RoomSettingsPage"
import SignUpPage from "@/pages/SignUpPage"
import LoginPage from "@/pages/LoginPage"
import { STORAGE_KEYS } from "@/lib/auth"
import { loadCatalogItems } from "@/lib/catalog"
import { loadLedgerSnapshotFromDb } from "@/lib/ledger"
import { loadRooms } from "@/lib/rooms"
import { supabase } from "@/lib/supabase"
import { useAppStore } from "@/store/appStore"

const navItems = [
  { to: "/", label: "메인" },
  { to: "/settings/prices", label: "가격표 설정" },
  { to: "/settings/rooms", label: "방 설정" },
]

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const setPriceItems = useAppStore((state) => state.setPriceItems)
  const setRoomsFromDb = useAppStore((state) => state.setRoomsFromDb)
  const setBusinessSessionsFromDb = useAppStore((state) => state.setBusinessSessionsFromDb)
  const setSalesHistoryFromDb = useAppStore((state) => state.setSalesHistoryFromDb)

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession()
      const savedAutoLogin = localStorage.getItem(STORAGE_KEYS.autoLoginEnabled)

      if (savedAutoLogin === "false" && data.session) {
        await supabase.auth.signOut()
        if (mounted) {
          setSession(null)
        }
      } else if (mounted) {
        setSession(data.session)
      }

      if (mounted) {
        setAuthLoading(false)
      }
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const username = useMemo(() => {
    const metaUsername = session?.user.user_metadata?.username
    if (typeof metaUsername === "string" && metaUsername.trim().length > 0) {
      return metaUsername
    }
    return session?.user.email ?? ""
  }, [session])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  useEffect(() => {
    if (!session) {
      return
    }
    let mounted = true
    const syncInitialData = async () => {
      const [nextPrices, nextRooms, ledgerSnapshot] = await Promise.all([
        loadCatalogItems(),
        loadRooms(),
        loadLedgerSnapshotFromDb(),
      ])
      if (mounted) {
        setPriceItems(nextPrices)
        setRoomsFromDb(nextRooms)
        setBusinessSessionsFromDb(
          ledgerSnapshot.sessions,
          ledgerSnapshot.activeBusinessSessionId,
        )
        setSalesHistoryFromDb(ledgerSnapshot.sales)
      }
    }
    void syncInitialData()
    return () => {
      mounted = false
    }
  }, [
    session,
    setBusinessSessionsFromDb,
    setPriceItems,
    setRoomsFromDb,
    setSalesHistoryFromDb,
  ])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
          <main className="rounded-lg border bg-card p-6 text-base">로그인 상태 확인 중...</main>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
          <header className="rounded-lg border bg-card p-4">
            <h1 className="text-2xl font-bold sm:text-3xl">노래방 장부관리</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              계정 로그인 후 메인 기능을 사용할 수 있습니다.
            </p>
          </header>
          <nav className="grid grid-cols-2 gap-2 sm:max-w-sm">
            <NavLink
              to="/login"
              className={({ isActive }) =>
                [
                  "rounded-lg border px-3 py-3 text-center text-base font-semibold transition",
                  isActive ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                ].join(" ")
              }
            >
              로그인
            </NavLink>
            <NavLink
              to="/signup"
              className={({ isActive }) =>
                [
                  "rounded-lg border px-3 py-3 text-center text-base font-semibold transition",
                  isActive ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                ].join(" ")
              }
            >
              회원가입
            </NavLink>
          </nav>
          <main className="rounded-lg border bg-card p-4 sm:p-6">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
        <header className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">장부관리</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground sm:text-base">{username}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="h-10 rounded-lg border px-3 text-sm font-semibold sm:text-base"
              >
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <nav className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "rounded-lg border px-3 py-3 text-center text-base font-semibold transition",
                  "sm:text-lg",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hover:bg-muted",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="rounded-lg border bg-card p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/settings/prices" element={<PriceSettingsPage />} />
            <Route path="/settings/rooms" element={<RoomSettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App

