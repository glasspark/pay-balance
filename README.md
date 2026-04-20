# PayBalance

모임 정산을 빠르게 끝내기 위한 3-Step 정산 웹 앱입니다.  
참여자 등록부터 항목별 지출 입력, 최종 송금 결과(영수증 형태)까지 한 화면 플로우로 제공합니다.

## 프로젝트 개요

- **목표**: 복잡한 모임 정산 과정을 직관적인 단계형 UI로 단순화
- **흐름**
  * Step1: 참여자 추가
  * Step2: 지출 항목 등록 + 항목별 분배 보정
  * Step3: 최종 정산 결과 및 계산 로직 확인

## 주요 기능

- 참여자 동적 추가/삭제 (최소 2명 기준)
- 사람별 지출 등록 (사용처 + 금액)
- 항목별 분배 편집
  - 제외
  - 고정 금액
  - 비율
- 최종 정산 송금 관계 자동 계산
- 결과를 영수증(Receipt) UI로 시각화
- 계산 방식 설명 팝오버(`?`) 제공
- 모바일 반응형 대응 (Step UI / 정산 편집 영역 포함)

## 기술 스택

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Lint**: ESLint
- **Deployment**: GitHub Pages + GitHub Actions (현재 비활성화)

## 구현 포인트

- 상태 기반 Step 전환 구조 (`currentStep`)
- 항목 단위 분배 데이터 모델링
  - `allocations`
  - `allocationFixedByParticipantId`
  - `allocationRatioByParticipantId`
  - `excludedParticipantIds`
- 분배 검증 및 정산 컨텍스트 생성
  - 개인별 실제 결제 금액
  - 개인별 목표 부담 금액
  - 차액 기반 송금 매칭

## 실행 방법

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 배포

- GitHub Actions 워크플로우: `.github/workflows/deploy.yml`
- Vite base 설정: `base: '/pay-balance/'`
- 배포 주소: [https://glasspark.github.io/pay-balance/](https://glasspark.github.io/pay-balance/)

## 디렉터리 구조

```text
.
├─ src/
│  ├─ App.tsx
│  ├─ App.css
│  └─ assets/
├─ public/
├─ .github/
│  └─ workflows/
│     └─ deploy.yml
└─ vite.config.ts
```

## 향후 개선 아이디어

- 정산 규칙 프리셋(균등/비율/고정) 저장
- 결과 공유 기능 고도화 (이미지/링크)
- 입력 유효성/예외처리 UX 개선
- 테스트 코드 도입 (계산 로직 단위 테스트)

