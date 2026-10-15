# HORSE RANCH 20.2 — Game Systems

기존 HORSE RANCH 20.1 Data Foundation에서 이어 개발하는 경주마 육성·목장 경영 시뮬레이션입니다. 3D 모델 검수 저장소와 별개의 **게임 본체** 저장소입니다.

## 게임 실행

GitHub Pages가 설정되어 있을 경우 [게임 실행](https://dfdfewqk.github.io/HORSE-RUNCH-game-/)에서 접속하거나, `index.html`을 브라우저에서 엽니다.

GitHub Pages가 아직 활성화되지 않은 경우 저장소 **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**를 선택합니다. 저장소 주소와 실제 배포 URL은 서로 다릅니다.

## 구현 상태

- 목장·보유마·훈련·번식·시장·혈통·기수·기록의 기존 20.1 로직 보존
- 목장 이름 → 고정 수말 → 첫 경주 → 5마리 중 암말 2마리 → 운영 시작
- 20.2: 시간 단계별 경주 엔진과 결승 순서·경주 기록·다시 보기 연결
- 기존 저장 키 `horse_ranch_v193` 유지, 기존 저장 호환성 우선
- 3D/이미지 개편 전 임시 말 그래픽 적용 (실제 3D 모델이 완성되었다는 의미 아님)
- `baseline/`에 20.1 Data Foundation 기준 파일 보존

## 주요 소스

- `index.html`: 게임 화면 및 20.1 기반 로직
- `systems/race-engine.js`: DOM과 저장 데이터에 독립적인 경주 계산
- `systems/race-integration.js`: 기존 게임의 상금·기록·기수 관계·경주 표시 연동
- `tests/race_engine.test.cjs`: Node.js 경주 계산 단위 테스트
- `docs/`: 테스트 결과와 시스템 개발 계획

## 테스트

```bash
node tests/race_engine.test.cjs
```

HTML은 외부 라이브러리 설치 없이 GitHub Pages에서 서비스할 수 있습니다. 게임 저장은 브라우저의 로컬 저장소에 보관되며 URL이나 도메인이 바뀌면 기존 저장 데이터가 자동 이전되지 않을 수 있습니다.

## 개발 규칙

기존 데이터와 정상 기능 보존, 변경사항 사전 테스트, 여러 파일 수정사항의 일괄 커밋, 불필요한 자동 배포 금지. 3D는 나중에 표현 계층으로 연결합니다.
