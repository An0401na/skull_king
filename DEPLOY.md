# 배포 · 문제 해결

## Render (온라인 + 로컬) — 메인 주소

**https://skull-king-hy5s.onrender.com/**

- 처음 접속이 **30~60초** 걸리면: 무료 플랜이 잠에서 깨는 중 → 새로고침
- `Not Found`가 잠깐 보였다가 사라지면 같은 이유일 수 있음
- **온라인** 탭으로 방 만들기 / 코드 참가

---

## GitHub Pages — Actions 실패할 때

`build` 가 9초 만에 실패하면 대부분 **Pages 설정** 문제입니다.

### 1) Pages 켜기 (필수, 한 번만)

1. https://github.com/An0401na/skull_king/settings/pages
2. **Build and deployment**
3. **Source:** `GitHub Actions` 선택 (Deploy from branch 아님)

### 2) 워크플로 다시 실행

1. https://github.com/An0401na/skull_king/actions
2. **Deploy GitHub Pages** → **Run workflow**

### 3) 성공 후 주소

https://an0401na.github.io/skull_king/

(저장소 이름이 `skull_king` 일 때)

Pages 빌드본은 **Render WebSocket**에 붙도록 `config.js`가 자동 생성됩니다.

---

## 코드 push

```bash
git add .
git commit -m "Fix Pages deploy and Render health check"
git push origin main
```

push 후 Actions가 자동 실행됩니다.
