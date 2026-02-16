import { NavLink, Route, Routes } from "react-router-dom"
import MainPage from "@/pages/MainPage"
import PriceSettingsPage from "@/pages/PriceSettingsPage"
import RoomSettingsPage from "@/pages/RoomSettingsPage"
import SignUpPage from "@/pages/SignUpPage"

const navItems = [
  { to: "/", label: "메인" },
  { to: "/signup", label: "회원가입" },
  { to: "/settings/prices", label: "가격표 설정" },
  { to: "/settings/rooms", label: "방 설정" },
]

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
        <header className="rounded-lg border bg-card p-4">
          <h1 className="text-2xl font-bold sm:text-3xl">노래방 장부관리</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            모바일 · 태블릿 · 웹에서 사용할 반응형 화면
          </p>
        </header>

        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/settings/prices" element={<PriceSettingsPage />} />
            <Route path="/settings/rooms" element={<RoomSettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App

