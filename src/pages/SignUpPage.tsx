import { useState } from "react"
import { Link } from "react-router-dom"
import { STORAGE_KEYS, toVirtualEmail } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

function SignUpPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isFormIncomplete = !username.trim() || !password || !confirmPassword

  const onUsernameChange = (value: string) => {
    const normalizedValue = value.replace(/[^a-zA-Z0-9]/g, "")
    setUsername(normalizedValue)
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 5) {
      setMessage("아이디는 5자 이상으로 입력해 주세요.")
      return
    }

    if (password !== confirmPassword) {
      setMessage("비밀번호가 일치하지 않습니다.")
      return
    }

    if (password.length < 8) {
      setMessage("비밀번호는 8자 이상으로 입력해 주세요.")
      return
    }

    setIsSubmitting(true)
    setMessage("")

    const email = toVirtualEmail(trimmedUsername)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: trimmedUsername,
          display_name: trimmedUsername,
        },
      },
    })

    if (signUpError) {
      setMessage(
        signUpError.message.includes("already registered")
          ? "이미 사용 중인 아이디입니다."
          : "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      )
      setIsSubmitting(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setMessage("회원가입은 되었지만 자동 로그인에 실패했습니다. 로그인 화면에서 다시 시도해 주세요.")
      setIsSubmitting(false)
      return
    }

    localStorage.setItem(STORAGE_KEYS.rememberedUsername, trimmedUsername)
    localStorage.setItem(STORAGE_KEYS.autoLoginEnabled, "true")
    setMessage("회원가입 및 로그인 완료")
    setIsSubmitting(false)
  }

  return (
    <section className="mx-auto w-full max-w-xl">
      <h2 className="text-xl font-bold sm:text-2xl">회원가입</h2>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">
        회원가입이 완료되면 바로 로그인됩니다.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold sm:text-base">아이디</span>
          <input
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
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

        <label className="block">
          <span className="mb-2 block text-sm font-semibold sm:text-base">
            비밀번호 확인
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 w-full rounded-lg border bg-background px-3 text-base outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            placeholder="비밀번호를 다시 입력하세요"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting || isFormIncomplete}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          회원가입
        </button>

        <p className="text-sm text-muted-foreground sm:text-base">
          이미 계정이 있으면 <Link to="/login" className="font-semibold underline">로그인</Link>
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

export default SignUpPage

