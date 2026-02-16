import { useState } from "react"

function SignUpPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!username.trim() || !password || !confirmPassword) {
      setMessage("모든 항목을 입력해 주세요.")
      return
    }

    if (password !== confirmPassword) {
      setMessage("비밀번호가 일치하지 않습니다.")
      return
    }

    setMessage("백엔드 연결 전 단계: 화면 검증용으로 정상 입력되었습니다.")
  }

  return (
    <section className="mx-auto w-full max-w-xl">
      <h2 className="text-xl font-bold sm:text-2xl">회원가입</h2>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">
        아이디/비밀번호 기반 간편 회원가입 화면
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold sm:text-base">아이디</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-12 w-full rounded-lg border bg-background px-3 text-base outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            placeholder="아이디를 입력하세요"
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
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground"
        >
          회원가입
        </button>

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

