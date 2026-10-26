# HORSE RANCH 20.15 기준 — 경주·NPC·경제 전담 브랜치 인수인계

- 기준 커밋: a0256b397b349d3c345866bdf3191659c84485d0 (작업 착수 시 main과 동일)
- 작업 브랜치: work/hr-racing-world-economy
- 저장 키: horse_ranch_v193 (유지)
- 시간: 360일/년, 30일/월 (유지)
- index.html / 출생·성장·교육/기수 관련 파일: 미수정
- **통합 담당(채팅 1)이 검토 후 병합**. 이 문서는 완료 선언이 아니라 변경 내용·검증 범위 기록이다.

## 구현·수정 완료 (담당 영역)
1. 경주 소유권 고정: NPC-only 경주에서는 시작 당시 말 소유 목장을 race.npcPurseOwners(말 ID → 목장명)에 기록한다. 플레이어 참가 경주도 경제 통합 래퍼에서 완료 당시 NPC 출전마 소유권을 기록한다.
2. 경주 상금 지급: ranch-economy.creditFinishedRaces는 새 경주의 소유권 스냅샷으로 수령 목장을 결정한다. 과거 저장과의 호환성을 위해 스냅샷 없는 레거시 경주는 기존 방식으로 처리한다. npcPurseSettled를 통한 중복 지급 방지는 유지한다.
3. 경매: NPC 자금이 실제 0원일 때 70,000,000원이 있다고 간주하던 두 곳의 fallback을 제거했다. 낙찰 이후 구매자 자금은 실제 잔고에서만 차감된다.
4. 일반 판매: 플레이어가 판매할 때 기존 판매 검증과 명마 기록 처리를 그대로 호출하고 실제 NPC 구매자에게 말을 이전한다. 상대 NPC 자금·마방이 부족하면 판매는 성사되지 않으며 가공 수익을 지급하지 않는다. Economy.buyerForPlayerSale(world,h,price) API가 구매 가능 NPC를 찾는다.
5. 자동 경주 뒤 등록 상태: 경주일 종료 시 실제로 마감된 경기의 미사용 플레이어 등록을 삭제해 향후 훈련·판매·등록을 영구 차단하지 않게 한다. 경기 날짜가 끝나기 전에는 참여 기회를 보존한다.
6. 경주 엔진: 각 시간 단계의 불변 마군 스냅샷으로 근접 주자·추월 여유·마군 방해를 소폭 계산한다. 시간 기준 방향 전환 쿨다운을 둔다. frames[].l과 raceDynamics[] (laneChanges, blockedSeconds)을 **추가**했으며 기존 frames[].p / v, results, behaviorEvents는 유지한다. 교육·궁합이 속도·지구력·파워에 직접 보너스를 주지 않는 원칙을 유지한다.
7. 목장 순위: 최근 경주 점수에 hard cap을 적용하여 장기 플레이 모든 상위 목장이 90점 동점이 되던 현상을 완만한 체감 함수 90*raw/(90+raw)로 교체했다. 최근 360일 기록·과거 소유 목장 귀속·상위 3마리 전력은 보존한다. 정확한 점수 비중은 플레이테스트 밸런스 대상이다.

## 통합 전제 / 다른 담당에게 필요한 것
- index.html 기존 스크립트 로딩 순서는 그대로 둔다.
- 핵심 인터페이스: HorseRanchRaceEngine.simulate({race, entrants, seed}), HorseRanchNpcAutoRacing.closeDay(world,day,ctx), HorseRanchEconomy.creditFinishedRaces(world), HorseRanchAuction.closeAuction(world,day), HorseRanchRanking.ranking(world).
- 새 경주 데이터 필드 race.npcPurseOwners는 일반 객체이며 필드는 race.result[].horseId(문자열 변환)에 대응한다. 이전 저장에는 없어도 안전하게 동작하도록 만들었다.
- 채팅 2 기수/교육 입력은 기존 entry.response={type,delay,paceWaste}를 그대로 읽는다. 새 직접 스탯 보너스는 없다.
- 3D 결과 연출, 공통 advanceDay 날짜 진행, 통합 UI 수정은 채팅 1 / 별도 3D 담당 범위.

## 실행·검증
- tests/racing_world_20_16.test.cjs: 결정론, 착순, 거부 반응, 원소유주 상금, 중복 지급, NPC 0원 경매, 플레이어 낙찰, 거래 가능 구매자, 순위 상한 회귀. **26검증 통과**.
- tests/racing_six_years_20_16.test.cjs: **6게임 연도 432경기**, 매월 사육비, NPC 조교·영입, 금요일 경매, 말 중복 소유/마방, 자금 음수, 연간 순위. **315검증 통과**.
- 기존 tests/horse_interaction_20_15.test.cjs: 교육/기수 반응과 경주 부작용 포함 **30,047검증 통과**.
- 세 테스트 파일은 동일 GitHub 소스를 JS 실행기에 불러와 실행했다(총 **30,388검증**). **실제 Node.js CLI 전체 테스트, GitHub Actions, 실제 브라우저/윈도우의 통합 수동 테스트는 이번 실행으로 검증하지 않았다.**

## 확인 필요 / 후속 밸런스
- 6년 가상 운영에서는 NPC 자금이 수억 원에서 수십억 원으로 증가한다. 경주 상금 유입으로 인한 **선형 증가**이며 고정비·상금 계수를 임의로 바꾸지는 않았다. 말 가격과 장기 경제 비율은 플레이테스트 후 별도 검증 필요.
- 20마리의 비슷한 실력 주자가 좁은 마군에 몰리면 일부 주자는 장시간 방해받을 수 있다. lane/blockedSeconds는 1차 단순화 모델이므로 실제 경주 영상/실제 게임 결과와 비교하여 추가 조정한다.
- 계좌/말 소유권의 브라우저 이벤트 및 기존 저장 이전 회귀는 채팅 1에서 전체 UI 통합 시험을 수행한다.
