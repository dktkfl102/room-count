# 초기 구성 정리

**Vite + React + Tailwind + shadcn/ui + SCSS**

## 기술 스택
- Vite
- React
- TypeScript
- Tailwind CSS (v3)
- SCSS (Sass)
- shadcn/ui
- Supabase + Vercel 

## 구성 완료 항목
- React + Vite 기본 엔트리 구성
  - `index.html`에서 `#root` 사용
  - `src/main.tsx`에서 React 렌더링
- Tailwind CSS + SCSS 기본 세팅
  - `tailwind.config.js`에 템플릿 경로 지정
  - shadcn/ui 테마 변수 및 색상 토큰 추가
  - `src/index.scss`에 base/style 레이어 및 변수 정의
- shadcn/ui 준비
  - `components.json` 생성
  - `@` alias 및 `cn()` 유틸 추가
- 불필요한 기본 템플릿 파일 제거

## 폴더/파일 구조 요약
- `src/main.tsx`  
  React 루트 엔트리
- `src/App.tsx`  
  최소 화면 텍스트만 포함된 기본 페이지
- `src/index.scss`  
  Tailwind 및 shadcn/ui 기본 테마
- `src/assets/`  
  이미지/아이콘 등 정적 자산 관리
- `src/lib/utils.ts`  
  `cn()` 유틸 함수
- `components.json`  
  shadcn/ui 설정 파일
- `vite.config.ts`  
  React 플러그인 및 경로 alias 설정

## 설치/실행
```bash
npm install
npm run dev
```

## 환경변수
`.env.example`을 복사해 `.env`로 만들고 값을 채워주세요.

```bash
cp .env.example .env
```

필수 항목:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 다음 단계 제안
- Supabase 프로젝트 생성 및 환경변수 설정
- 로그인/회원가입 UI 및 테이블 스키마 설계
- 설정 페이지(기본 단가) UI 및 저장 로직 연결

## 참고
- shadcn/ui는 Tailwind v3 기반으로 구성되어 있습니다.  
  v4로 올리려면 테마 구성과 플러그인 세팅 변경이 필요합니다.
- SCSS는 대규모 스타일 관리에 익숙한 팀에 특히 유리합니다.  
  Tailwind를 주로 쓰되, 전역 테마/유틸 보강 용도로 SCSS를 병행하는 구성이 무난합니다.

