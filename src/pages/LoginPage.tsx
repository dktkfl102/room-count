import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { STORAGE_KEYS, normalizeUsername, toVirtualEmail, validateUsername } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

function LoginPage() {
  const rememberedUsername = useMemo(
    () => localStorage.getItem(STORAGE_KEYS.rememberedUsername) ?? "",
    [],
  )
  const rememberedAutoLogin = useMemo(
    () => localStorage.getItem(STORAGE_KEYS.autoLoginEnabled),
    [],
  )

  const [username, setUsername] = useState(rememberedUsername)
  const [password, setPassword] = useState("")
  const [rememberUsername, setRememberUsername] = useState(Boolean(rememberedUsername))
  const [autoLogin, setAutoLogin] = useState(rememberedAutoLogin !== "false")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    const usernameError = validateUsername(username)
    if (usernameError) {
      setMessage(usernameError)
      return
    }

    if (!password) {
      setMessage("비밀번호를 입력해 주세요.")
      return
    }

    setIsSubmitting(true)
    setMessage("")

    const { error } = await supabase.auth.signInWithPassword({
      email: toVirtualEmail(username),
      password,
    })

    if (error) {
      setMessage("로그인에 실패했습니다. 아이디/비밀번호를 확인해 주세요.")
      setIsSubmitting(false)
      return
    }

    if (rememberUsername) {
      localStorage.setItem(STORAGE_KEYS.rememberedUsername, username.trim())
    } else {
      localStorage.removeItem(STORAGE_KEYS.rememberedUsername)
    }
    localStorage.setItem(STORAGE_KEYS.autoLoginEnabled, autoLogin ? "true" : "false")
    setPassword("")
    setMessage("로그인 성공")
    setIsSubmitting(false)
  }

  return (
    <section className="mx-auto w-full max-w-xl">
      <h2 className="text-xl font-bold sm:text-2xl">로그인</h2>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">
        같은 기기에서는 자동 로그인 유지가 가능합니다.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold sm:text-base">아이디</span>
          <input
            value={username}
            onChange={(event) => setUsername(normalizeUsername(event.target.value))}
            className="h-12 w-full rounded-lg border bg-background px-3 text-base outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            placeholder="아이디를 입력하세요"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={20}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold sm:text-base">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-lg border bg-background px-3 text-base outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            placeholder="비밀번호를 입력하세요"
          />
        </label>

        <label className="flex items-center gap-2 text-sm sm:text-base">
          <input
            type="checkbox"
            checked={rememberUsername}
            onChange={(event) => setRememberUsername(event.target.checked)}
            className="h-4 w-4"
          />
          아이디 저장
        </label>

        <label className="flex items-center gap-2 text-sm sm:text-base">
          <input
            type="checkbox"
            checked={autoLogin}
            onChange={(event) => setAutoLogin(event.target.checked)}
            className="h-4 w-4"
          />
          자동 로그인
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          로그인
        </button>

        <p className="text-sm text-muted-foreground sm:text-base">
          계정이 없으면 <Link to="/signup" className="font-semibold underline">회원가입</Link>
        </p>

        {message ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground sm:text-base">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  )
}

export default LoginPage



