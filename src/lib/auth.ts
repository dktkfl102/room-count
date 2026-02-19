export const STORAGE_KEYS = {
  rememberedUsername: "room-count:remembered-username",
  autoLoginEnabled: "room-count:auto-login-enabled",
} as const

const toHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export const toVirtualEmail = (username: string) => {
  const trimmed = username.trim().toLowerCase()
  const normalized = trimmed.replace(/[^a-z0-9]/g, "")
  const safeLocalPart = (normalized.slice(0, 20) || "user")
  const hash = toHash(trimmed)
  return `u${safeLocalPart}${hash}@roomcount.app`
}

export const validateUsername = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.length < 2 || trimmed.length > 30) {
    return "아이디는 2~30자로 입력해 주세요."
  }
  return null
}


