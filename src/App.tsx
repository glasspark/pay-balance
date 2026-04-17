import {useState} from 'react'
import './App.css'
import closeIcon from './assets/close.svg'
import addIcon from './assets/add.svg'
import removeIcon from './assets/remove.svg'
import refreshIcon from './assets/refresh.svg'
import warningIcon from './assets/warning_amber.svg'
import doneIcon from './assets/done.svg'
import questionIcon from './assets/question.svg'


const presetAmounts = [10, 50, 100, 500, 1000, 5000, 10000, 50000]
const maxLength = 10;
const MAX_AMOUNT = 100_000_000

const settlementTypeCards = [
    {
        title: '기본 균등 분배',
        description: '항목 등록 시 참여자에게\n기본값으로 균등 분배됩니다.',
    },
    {
        title: '항목별 분배 보정',
        description: '각 항목에서 사람별 부담 금액을\n직접 조정할 수 있습니다.',
    },
    {
        title: '제외 대상 설정',
        description: '특정 항목에서 빠질 사람을\n 제외하고 나머지 사람들에게\n 재분배합니다.',
    },
    {
        title: '고정 금액 반영',
        description: '사람별 고정 부담액을 먼저 반영한 뒤 남은 금액을 분배합니다.',
    },
    {
        title: '비율/퍼센트 입력',
        description: '비율(1:2:1) 또는 퍼센트(%) 모드로 항목별 부담 비중을 설정합니다.',
    },
]

type ParticipantInput = {
    id: string
    name: string
}

type Participant = {
    id: string
    name: string
    expenseAmount: string   // 일단 input 제어용 string
    expenseSource: string   // 어디서 사용했는지
}

type ExpenseItem = {
    id: string
    participantId: string
    participantName: string
    source: string
    amount: number
    excludedParticipantIds: string[]
    allocations: Record<string, number>
    allocationFixedByParticipantId: Record<string, number>
    allocationRatioByParticipantId: Record<string, number>
}

type Settlement = { from: string; to: string; amount: number }
type AllocationInputMode = 'ratio' | 'percent'


function App() {

    // 첫 렌더부터 입력창이 2개
    // Step1에서 사용자가 직접 입력 중인 참여자 이름 입력창 상태
    const [participantInputs, setParticipantInputs] = useState<ParticipantInput[]>([
        {id: crypto.randomUUID(), name: ''},
        {id: crypto.randomUUID(), name: ''},
    ])
    // Step1 입력 완료 후 Step2/Step3에서 사용할 확정 참여자 데이터
    const [participants, setParticipants] = useState<Participant[]>([])

    // 입력 검증 실패 메시지(예: 최소 인원 미달, 빈 이름)
    const [inputError, setInputError] = useState('')

    // 현재 화면 단계(1: 참여자 입력, 2: 정산금액 입력, 3: 정산 결과)
    const [currentStep, setCurrentStep] = useState(1)

    // Step2에서 상세 입력 패널이 열려 있는 참여자 id 목록(다중 토글용)
    const [openParticipantIds, setOpenParticipantIds] = useState<string[]>([])
    // Step3 계산 방식 안내 박스 노출 상태
    const [showReceiptHelp, setShowReceiptHelp] = useState(false)
    // 정산금 내역 리스트
    const [expenseList, setExpenseList] = useState<ExpenseItem[]>([])
    // Step2 항목별 분배 상세 편집 열림 상태
    const [openExpenseEditorId, setOpenExpenseEditorId] = useState<string | null>(null)
    // 항목 분배 표기 모드
    const [allocationInputMode] = useState<AllocationInputMode>('ratio')

    const buildAllocationsFromRule = (
        amount: number,
        participantIds: string[],
        fixedByParticipantId: Record<string, number>,
        ratioByParticipantId: Record<string, number>,
    ) => {
        const allocations: Record<string, number> = {}
        participants.forEach((participant) => {
            allocations[participant.id] = 0
        })

        if (participantIds.length === 0 || amount <= 0) return allocations

        const eligibleIds = participantIds.filter((id) => participants.some((participant) => participant.id === id))
        let fixedTotal = 0
        eligibleIds.forEach((id) => {
            const fixed = Math.max(0, fixedByParticipantId[id] ?? 0)
            allocations[id] = fixed
            fixedTotal += fixed
        })

        const remaining = Math.max(0, Math.round(amount) - fixedTotal)
        const variableIds = eligibleIds.filter((id) => (fixedByParticipantId[id] ?? 0) <= 0)
        if (remaining <= 0 || variableIds.length === 0) return allocations

        const totalRatio = variableIds.reduce((sum, id) => sum + Math.max(1, ratioByParticipantId[id] ?? 1), 0)
        const rawShares = variableIds.map((id) => {
            const ratio = Math.max(1, ratioByParticipantId[id] ?? 1)
            const raw = remaining * (ratio / totalRatio)
            return {id, raw, floor: Math.floor(raw), fraction: raw - Math.floor(raw)}
        })
        const floorTotal = rawShares.reduce((sum, share) => sum + share.floor, 0)
        const leftover = remaining - floorTotal
        const sorted = [...rawShares].sort((a, b) => b.fraction - a.fraction)
        const extraById: Record<string, number> = {}
        sorted.forEach((share) => {
            extraById[share.id] = 0
        })
        for (let i = 0; i < leftover; i += 1) {
            const target = sorted[i % sorted.length]
            extraById[target.id] += 1
        }

        rawShares.forEach((share) => {
            allocations[share.id] += share.floor + (extraById[share.id] ?? 0)
        })
        return allocations
    }

    const recalculateExpenseAllocations = (expense: ExpenseItem) => {
        const eligibleIds = participants
            .map((participant) => participant.id)
            .filter((participantId) => !expense.excludedParticipantIds.includes(participantId))
        return buildAllocationsFromRule(
            expense.amount,
            eligibleIds,
            expense.allocationFixedByParticipantId,
            expense.allocationRatioByParticipantId,
        )
    }

    // 등록 시 숫자 파싱 (쉼표 제거 후 반환)
    const handleRegisterExpense = (participant: Participant) => {
        const source = participant.expenseSource.trim()
        const amount = Number(participant.expenseAmount.replace(/,/g, ''))
        const excludedParticipantIds: string[] = []
        const eligibleParticipantIds = participants.map((item) => item.id)

        if (!source || !Number.isFinite(amount) || amount <= 0) return

        const allocationFixedByParticipantId: Record<string, number> = {}
        const allocationRatioByParticipantId: Record<string, number> = {}
        participants.forEach((item) => {
            allocationFixedByParticipantId[item.id] = 0
            allocationRatioByParticipantId[item.id] = 1
        })
        const allocations = buildAllocationsFromRule(
            Math.round(amount),
            eligibleParticipantIds,
            allocationFixedByParticipantId,
            allocationRatioByParticipantId,
        )

        setExpenseList((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                participantId: participant.id,
                participantName: participant.name,
                source,
                amount,
                excludedParticipantIds,
                allocations,
                allocationFixedByParticipantId,
                allocationRatioByParticipantId,
            },
        ])

        // 등록 후 해당 입력값 초기화
        setParticipants((prev) =>
            prev.map((p) =>
                p.id === participant.id ? {...p, expenseSource: '', expenseAmount: ''} : p
            )
        )
    }

    // 각 정산금액 리스트의 항목을 개별 삭제
    const deleteExpense = (participantId: string, expenseId: string) => {
        setExpenseList((prev) =>
            prev.filter(
                (item) => !(item.participantId === participantId && item.id === expenseId)
            )
        )
        setOpenExpenseEditorId((prev) => (prev === expenseId ? null : prev))
    }

    const updateExpenseAllocationFixed = (expenseId: string, participantId: string, rawValue: string) => {
        const numeric = Math.max(0, Number(rawValue.replace(/[^\d]/g, '')) || 0)
        setExpenseList((prev) =>
            prev.map((expense) => {
                if (expense.id !== expenseId) return expense
                const updatedExpense = {
                    ...expense,
                    allocationFixedByParticipantId: {
                        ...expense.allocationFixedByParticipantId,
                        [participantId]: numeric,
                    },
                }
                return {
                    ...updatedExpense,
                    allocations: recalculateExpenseAllocations(updatedExpense),
                }
            }),
        )
    }

    const updateExpenseAllocationRatio = (expenseId: string, participantId: string, rawValue: string) => {
        const numeric = Math.max(0, Number(rawValue.replace(/[^\d]/g, '')) || 0)
        setExpenseList((prev) =>
            prev.map((expense) => {
                if (expense.id !== expenseId) return expense
                const updatedExpense = {
                    ...expense,
                    allocationRatioByParticipantId: {
                        ...expense.allocationRatioByParticipantId,
                        [participantId]: numeric,
                    },
                }
                return {
                    ...updatedExpense,
                    allocations: recalculateExpenseAllocations(updatedExpense),
                }
            }),
        )
    }

    const toggleExpenseAllocationExcluded = (expenseId: string, participantId: string) => {
        setExpenseList((prev) =>
            prev.map((expense) => {
                if (expense.id !== expenseId) return expense
                const isExcluded = expense.excludedParticipantIds.includes(participantId)
                const updatedExpense = {
                    ...expense,
                    excludedParticipantIds: isExcluded
                        ? expense.excludedParticipantIds.filter((id) => id !== participantId)
                        : [...expense.excludedParticipantIds, participantId],
                }
                return {
                    ...updatedExpense,
                    allocations: recalculateExpenseAllocations(updatedExpense),
                }
            }),
        )
    }

    //  금액 입력 핸들러
    const handleAmountChange = (id: string, rawValue: string) => {
        const onlyDigits = rawValue.replace(/[^\d]/g, '')
        if (!onlyDigits) {
            setParticipants((prev) =>
                prev.map((p) => (p.id === id ? {...p, expenseAmount: ''} : p)),
            )
            return
        }

        const numeric = Math.min(Number(onlyDigits), MAX_AMOUNT)
        const formatted = numeric.toLocaleString('ko-KR')

        setParticipants((prev) =>
            prev.map((p) => (p.id === id ? {...p, expenseAmount: formatted} : p)),
        )
    }

    const handleSourceChange = (id: string, value: string) => {
        setParticipants(prev => prev.map(p => p.id === id ? {...p, expenseSource: value} : p))
    }

    const toggleParticipantDetail = (id: string) => {
        setOpenParticipantIds((prev) =>
            prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
        )
    }

    const formatAmount = (amount: number) => {
        return amount.toLocaleString('ko-KR')
    }

    // 각 개인별 금액의 총 합을 구한다.
    const getParticipantTotal = (participantId: string) => {
        return expenseList
            .filter((item) => item.participantId === participantId)
            .reduce((sum, item) => sum + item.amount, 0)
    }

    const getExpenseAllocationSum = (expense: ExpenseItem) => {
        return participants.reduce(
            (sum, participant) => sum + (expense.allocations[participant.id] ?? 0),
            0,
        )
    }

    const getExpenseAllocationMismatchMessage = (expense: ExpenseItem) => {
        const eligibleIds = participants
            .map((participant) => participant.id)
            .filter((participantId) => !expense.excludedParticipantIds.includes(participantId))
        if (eligibleIds.length === 0) {
            return `항목 "${expense.source}"의 분배 대상이 없습니다.`
        }
        const fixedTotal = eligibleIds.reduce(
            (sum, participantId) => sum + (expense.allocationFixedByParticipantId[participantId] ?? 0),
            0,
        )
        if (fixedTotal > expense.amount) {
            return `항목 "${expense.source}"의 고정 금액 합계가 항목 금액보다 큽니다.`
        }
        const allocationSum = getExpenseAllocationSum(expense)
        if (Math.round(allocationSum) !== Math.round(expense.amount)) {
            return `항목 "${expense.source}" 분배 합계가 항목 금액과 일치하지 않습니다.`
        }
        return ''
    }

    const buildSettlementContext = () => {
        const spentByParticipantId = expenseList.reduce<Record<string, number>>((acc, item) => {
            acc[item.participantId] = (acc[item.participantId] ?? 0) + item.amount
            return acc
        }, {})
        const totalSpent = participants.reduce(
            (sum, participant) => sum + (spentByParticipantId[participant.id] ?? 0),
            0,
        )
        const targetByParticipantId: Record<string, number> = {}
        let validationError = ''

        if (participants.length === 0) {
            return {
                spentByParticipantId,
                totalSpent,
                targetByParticipantId,
                validationError,
            }
        }

        participants.forEach((participant) => {
            targetByParticipantId[participant.id] = 0
        })

        expenseList.forEach((expense) => {
            const eligibleIds = participants
                .map((participant) => participant.id)
                .filter((participantId) => !expense.excludedParticipantIds.includes(participantId))
            if (eligibleIds.length === 0) {
                validationError = `항목 "${expense.source}"의 분배 대상이 없습니다.`
                return
            }
            const fixedTotal = eligibleIds.reduce(
                (sum, participantId) => sum + (expense.allocationFixedByParticipantId[participantId] ?? 0),
                0,
            )
            if (fixedTotal > expense.amount) {
                validationError = `항목 "${expense.source}"의 고정 금액 합계가 항목 금액보다 큽니다.`
                return
            }
            const allocationEntries = Object.entries(expense.allocations || {})
            if (allocationEntries.length === 0) {
                validationError = `항목 "${expense.source}" 분배 데이터가 없습니다.`
                return
            }
            let allocationSum = 0
            allocationEntries.forEach(([participantId, amount]) => {
                if (!participants.some((participant) => participant.id === participantId)) return
                const normalizedAmount = Math.max(0, amount)
                allocationSum += normalizedAmount
                targetByParticipantId[participantId] += normalizedAmount
            })
            if (Math.round(allocationSum) !== Math.round(expense.amount)) {
                validationError = `항목 "${expense.source}" 분배 합계가 항목 금액과 다릅니다.`
            }
        })

        return {
            spentByParticipantId,
            totalSpent,
            targetByParticipantId,
            validationError,
        }
    }

    // Step3 정산 결과 계산:
    // 개인별 지출 합계와 목표 부담액을 비교해 송금 관계를 생성한다.
    const buildSettlements = (): Settlement[] => {
        if (participants.length === 0) return []
        const context = buildSettlementContext()

        // 더 낸 사람(받을 사람) 목록
        const creditors = participants
            .map((participant) => ({
                name: participant.name,
                amount: (context.spentByParticipantId[participant.id] ?? 0) - (context.targetByParticipantId[participant.id] ?? 0),
            }))
            .filter((item) => item.amount > 0)

        // 덜 낸 사람(보낼 사람) 목록
        const debtors = participants
            .map((participant) => ({
                name: participant.name,
                amount: (context.targetByParticipantId[participant.id] ?? 0) - (context.spentByParticipantId[participant.id] ?? 0),
            }))
            .filter((item) => item.amount > 0)

        // 채무자/채권자를 순서대로 매칭해 최소 송금 횟수에 가깝게 정산 목록을 만든다.
        const settlements: Settlement[] = []
        let debtorIndex = 0
        let creditorIndex = 0

        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const transferAmount = Math.min(
                debtors[debtorIndex].amount,
                creditors[creditorIndex].amount,
            )

            if (transferAmount <= 0) break

            settlements.push({
                from: debtors[debtorIndex].name,
                to: creditors[creditorIndex].name,
                amount: transferAmount,
            })

            debtors[debtorIndex].amount -= transferAmount
            creditors[creditorIndex].amount -= transferAmount

            if (debtors[debtorIndex].amount <= 0) debtorIndex += 1
            if (creditors[creditorIndex].amount <= 0) creditorIndex += 1
        }

        return settlements
    }
    // 프리셋 더하기도 쉼표 문자열 기준으로 파싱
    const handlePresetAmountClick = (id: string, addAmount: number) => {
        setParticipants((prev) =>
            prev.map((p) => {
                if (p.id !== id) return p
                const current = Number((p.expenseAmount || '').replace(/,/g, '')) || 0
                const next = Math.min(current + addAmount, MAX_AMOUNT)
                return {...p, expenseAmount: next.toLocaleString('ko-KR')}
            }),
        )
    }

    const addParticipant = () => {
        if (participantInputs.length >= 20) {
            return;
        }

        setParticipantInputs((prev) => [
            ...prev,
            {id: crypto.randomUUID(), name: ''},
        ])
    }
    const handleRemoveParticipant = (id: string) => {
        if (participantInputs.length <= 2) {
            return;
        }
        setParticipantInputs((prev) => prev.filter((item) => item.id !== id))
    }

    const handleNameChange = (id: string, value: string) => {
        setParticipantInputs((prev) =>
            prev.map((item) => (item.id === id ? {...item, name: value} : item)),
        )
    }

    const handleReset = () => {
        setParticipantInputs([
            {id: crypto.randomUUID(), name: ''},
            {id: crypto.randomUUID(), name: ''},
        ])
        setInputError('')
    }

    const validParticipantCount = participantInputs.filter(
        (item) => item.name.trim().length > 0,
    ).length
    const canProceedStep1 = validParticipantCount >= 2

    const goToStep2 = () => {
        if (!canProceedStep1) {
            setInputError('최소 2명의 참여자 이름을 입력해주세요.')
            return
        }

        const normalizedParticipants = participantInputs
            .map((item) => ({
                id: item.id,
                name: item.name.trim(),
                expenseAmount: '',
                expenseSource: '',
            }))
            .filter((item) => item.name.length > 0)

        if (normalizedParticipants.length <= 1) {
            setInputError('최소 2명의 참여자 이름을 입력해주세요.')
            return
        }

        setParticipants(normalizedParticipants)
        setInputError('')
        setCurrentStep(2)
    }

    const goToStep3 = () => {
        setCurrentStep(3)
    }

    const settlementContext = buildSettlementContext()
    const settlements = buildSettlements()
    const totalSpent = settlementContext.totalSpent
    const step2BlockingMessage = (settlementContext.validationError.includes('분배 합계가 항목 금액과 다릅니다.')
        || settlementContext.validationError.includes('분배 합계가 항목 금액과 일치하지 않습니다.'))
        ? '분배 합계가 맞지 않는 항목이 있습니다. 각 항목의 분배 합계를 확인해주세요.'
        : settlementContext.validationError
    const participantTotals = participants.map((participant) => {
        const items = expenseList.filter((item) => item.participantId === participant.id)
        const total = items.reduce((sum, item) => sum + item.amount, 0)
        return {participant, items, total}
    })
    const participantSettlementSummary = participants.map((participant) => {
        const paid = settlementContext.spentByParticipantId[participant.id] ?? 0
        const burden = settlementContext.targetByParticipantId[participant.id] ?? 0
        const diff = paid - burden
        return {
            id: participant.id,
            name: participant.name,
            paid,
            burden,
            diff,
        }
    })
    const expenseRuleSummaryRows = expenseList.map((expense) => {
        const excludedNames = expense.excludedParticipantIds
            .map((id) => participants.find((participant) => participant.id === id)?.name)
            .filter((name): name is string => Boolean(name))

        const fixedEntries = participants
            .map((participant) => ({
                name: participant.name,
                fixed: expense.allocationFixedByParticipantId[participant.id] ?? 0,
            }))
            .filter((entry) => entry.fixed > 0)

        const ratioEntries = participants
            .filter((participant) => !expense.excludedParticipantIds.includes(participant.id))
            .filter((participant) => (expense.allocationFixedByParticipantId[participant.id] ?? 0) <= 0)
            .map((participant) => ({
                name: participant.name,
                value: expense.allocationRatioByParticipantId[participant.id] ?? (allocationInputMode === 'percent' ? 0 : 1),
            }))

        return {
            id: expense.id,
            source: expense.source,
            excludedText: excludedNames.length > 0 ? excludedNames.join(', ') : '-',
            fixedText: fixedEntries.length > 0
                ? fixedEntries.map((entry) => `${entry.name} ${formatAmount(entry.fixed)}원`).join(', ')
                : '-',
            ratioText: ratioEntries.length > 0
                ? ratioEntries
                    .map((entry) =>
                        allocationInputMode === 'percent'
                            ? `${entry.name} ${entry.value}%`
                            : `${entry.name} ${entry.value}`,
                    )
                    .join(', ')
                : '-',
        }
    })
    const startNewCalculation = () => {
        setParticipantInputs([
            {id: crypto.randomUUID(), name: ''},
            {id: crypto.randomUUID(), name: ''},
        ])
        setParticipants([])
        setExpenseList([])
        setOpenParticipantIds([])
        setInputError('')
        setShowReceiptHelp(false)
        setCurrentStep(1)
    }

    const shareTemporarily = () => {
        window.alert('공유 기능은 준비 중입니다.')
    }

    return (
        <main className="page">
            <header className="page-header">
                <h1>PayBalance</h1>
            </header>

            <section className="hero-section">
                <h1 className="step-kicker">PayBalance</h1>
                <h2 className="step-title">모임 정산이 늘 헷갈리셨나요?</h2>
                <p className="step-description">
                    누군가는 더 냈고, 누군가는 덜 냈지만 계산은 늘 복잡합니다.
                    <br/>
                    각자 결제한 금액을 입력하면 총 지출 금액, 1인당 부담 금액, 최종 송금 관계를 한 번에 해결!
                </p>
            </section>

            <section className="settlement-type-section">
                <div className="settlement-type-grid">
                    {settlementTypeCards.map((card, index) => (
                        <article className="settlement-type-card" key={`feature-${index}`}>
                            <strong className="settlement-type-title">{card.title}</strong>
                            <p className="settlement-type-description">{card.description}</p>
                        </article>
                    ))}
                </div>
            </section>


            <section className="step-content">
                <ol className="step1-progress" aria-label="진행 단계">
                    <li className={currentStep === 1 ? 'step1-progress-item is-current' : currentStep > 1 ? 'step1-progress-item is-done' : 'step1-progress-item'}>
                        <span className="step1-progress-badge">
                            {currentStep > 1 ? <img src={doneIcon} alt="완료"/> : '1'}
                        </span>
                        <span>정산멤버 추가</span>
                    </li>
                    <li className={currentStep === 2 ? 'step1-progress-item is-current' : currentStep > 2 ? 'step1-progress-item is-done' : 'step1-progress-item'}>
                        <span className="step1-progress-badge">
                            {currentStep > 2 ? <img src={doneIcon} alt="완료"/> : '2'}
                        </span>
                        <span>정산금액 입력</span>
                    </li>
                    <li className={currentStep === 3 ? 'step1-progress-item is-current' : 'step1-progress-item'}>
                        <span className="step1-progress-badge">3</span>
                        <span>정산결과</span>
                    </li>
                </ol>

                {currentStep === 1 ? (
                    <>
                        <article className="step-card">
                            <h2>정산멤버 등록</h2>
                            <section className="step1-notice" aria-label="정산 안내">
                                <div className="step1-notice-left">
                                    <div className="step1-notice-title-row">
                                        <img src={warningIcon} alt=""/>
                                        <p>정산 멤버 등록</p>
                                    </div>
                                    <p className="step1-notice-description"> - 정산 멤버는 최소 2인에서 최대 20명 까지 가능합니다.
                                    </p>
                                </div>
                            </section>

                            {participantInputs.map((item, index) => (
                                <div className="input-row participant-input-row" key={item.id}>
                                    <input
                                        id={`participant-${item.id}`}
                                        type="text"
                                        placeholder="정산 멤버 이름"
                                        value={item.name}
                                        onChange={(event) => handleNameChange(item.id, event.target.value)}
                                        maxLength={maxLength}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => handleRemoveParticipant(item.id)}
                                        aria-label={`참여자 ${index + 1} 삭제`}
                                        className="participant-remove-button"
                                        disabled={participantInputs.length <= 2}>
                                        <img src={closeIcon} alt=""/>
                                    </button>

                                </div>
                            ))}

                            {inputError ? (
                                <p className="error-message" role="alert">
                                    {inputError}
                                </p>
                            ) : null}

                            <div className="action-row">
                                <button type="button" className="btn step1-add-member-button" onClick={addParticipant}>
                                    + 정산 멤버 추가
                                </button>
                            </div>
                        </article>

                        <div className="step1-bottom-actions">
                            <button type="button" className="btn btn-secondary reset-action-button"
                                    onClick={handleReset}>
                                <img src={refreshIcon} alt=""/> 초기화
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={goToStep2}
                                disabled={!canProceedStep1}
                            >
                                다음
                            </button>
                        </div>
                    </>
                ) : null}

                {currentStep === 2 ? (
                    <>
                        <article className="step-card">
                            <h2>정산금액 입력</h2>

                            {step2BlockingMessage ? (
                                <p className="error-message" role="alert">
                                    {step2BlockingMessage}
                                </p>
                            ) : null}

                            <ul className="participant-expense-list">
                                {participants.map((participant) => {
                                    const isOpen = openParticipantIds.includes(participant.id)
                                    return (
                                        <li key={participant.id} className="participant-item">
                                            <div className="participant-summary-row">
                                                <span>{participant.name}</span>
                                                <div className="participant-summary-actions">
                                                    <span>{getParticipantTotal(participant.id).toLocaleString()}원</span>
                                                    <button
                                                        type="button"
                                                        className={`participant-toggle-button ${isOpen ? 'open' : ''}`}
                                                        onClick={() => toggleParticipantDetail(participant.id)}
                                                        aria-expanded={isOpen}
                                                        aria-controls={`detail-${participant.id}`}>
                                                        <img src={isOpen ? removeIcon : addIcon} alt=""/>
                                                    </button>
                                                </div>
                                            </div>
                                            <ul className="expense-history-list">
                                                {expenseList.filter((item) => item.participantId === participant.id).map((item) => (
                                                    <li key={`${item.participantId}-${item.id}`}
                                                        className="expense-item">
                                                        <div className="expense-item-main">
                                                            <span className="expense-source">{item.source}</span>
                                                            <div className="expense-item-actions">
                                                            <span
                                                                className="expense-amount">{item.amount.toLocaleString()}원</span>
                                                                <button
                                                                    type="button"
                                                                    className={`expense-adjust-button ${openExpenseEditorId === item.id ? 'open' : ''}`}
                                                                    onClick={() =>
                                                                        setOpenExpenseEditorId((prev) => (prev === item.id ? null : item.id))
                                                                    }
                                                                >
                                                                    분배
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="expense-delete-button"
                                                                    onClick={() => deleteExpense(item.participantId, item.id)}
                                                                >
                                                                    <img src={closeIcon} alt=""/>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {openExpenseEditorId === item.id ? (
                                                            <div className="expense-allocation-editor">
                                                                <p>항목 분배 보정 (사람별 고정/비율/제외)</p>
                                                                <ul>
                                                                    {participants.map((targetParticipant) => (
                                                                        <li key={`${item.id}-${targetParticipant.id}`}>
                                                                            <span>
                                                                                {targetParticipant.id === item.participantId ? (
                                                                                    <em className="payer-badge">결제자</em>
                                                                                ) : null}
                                                                                {targetParticipant.name}
                                                                            </span>
                                                                            <label
                                                                                className="allocation-cell exclude-cell">
                                                                                <small>제외</small>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={item.excludedParticipantIds.includes(targetParticipant.id)}
                                                                                    onChange={() => toggleExpenseAllocationExcluded(item.id, targetParticipant.id)}
                                                                                />
                                                                            </label>
                                                                            <label className="allocation-cell">
                                                                                <small>고정</small>
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="numeric"
                                                                                    value={formatAmount(item.allocationFixedByParticipantId[targetParticipant.id] ?? 0)}
                                                                                    onChange={(event) =>
                                                                                        updateExpenseAllocationFixed(item.id, targetParticipant.id, event.target.value)
                                                                                    }
                                                                                    disabled={item.excludedParticipantIds.includes(targetParticipant.id)}
                                                                                />
                                                                            </label>
                                                                            <label className="allocation-cell">
                                                                                <small>비율</small>
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="numeric"
                                                                                    value={String(item.allocationRatioByParticipantId[targetParticipant.id] ?? 1)}
                                                                                    onChange={(event) =>
                                                                                        updateExpenseAllocationRatio(item.id, targetParticipant.id, event.target.value)
                                                                                    }
                                                                                    disabled={item.excludedParticipantIds.includes(targetParticipant.id)}
                                                                                />
                                                                            </label>
                                                                            <span className="allocation-amount">
                                                                                {formatAmount(item.allocations[targetParticipant.id] ?? 0)}원
                                                                            </span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                                <p className="allocation-summary">
                                                                    분배 합계: {formatAmount(
                                                                    getExpenseAllocationSum(item),
                                                                )}원 / 항목 금액: {formatAmount(item.amount)}원
                                                                </p>
                                                                {getExpenseAllocationMismatchMessage(item) ? (
                                                                    <p className="error-message allocation-error-message" role="alert">
                                                                        {getExpenseAllocationMismatchMessage(item)}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                    </li>
                                                ))}
                                            </ul>
                                            {isOpen ? (
                                                <div id={`detail-${participant.id}`}
                                                     className="participant-detail-panel">

                                                    <div className="input-row">
                                                        <label htmlFor={`source-${participant.id}`}>사용처</label>
                                                        <input
                                                            id={`source-${participant.id}`}
                                                            type="text"
                                                            placeholder="예: 점심, 카페"
                                                            value={participant.expenseSource}
                                                            maxLength={20}
                                                            onChange={(e) =>
                                                                handleSourceChange(participant.id, e.target.value)
                                                            }
                                                        />
                                                    </div>
                                                    <div className="input-row">
                                                        <label htmlFor={`amount-${participant.id}`}>금액</label>
                                                        <input
                                                            id={`amount-${participant.id}`}
                                                            type="text"
                                                            inputMode="numeric"
                                                            placeholder="예: 12,000"
                                                            maxLength={12}
                                                            value={participant.expenseAmount}
                                                            onChange={(e) => handleAmountChange(participant.id, e.target.value)}
                                                        />
                                                        <div className="amount-preset-list">
                                                            {presetAmounts.map((amount) => (
                                                                <button
                                                                    key={amount}
                                                                    type="button"
                                                                    className="btn amount-preset-button"
                                                                    onClick={() => handlePresetAmountClick(participant.id, amount)}
                                                                >
                                                                    {formatAmount(amount)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <button className="btn expense-submit-button"
                                                                onClick={() => handleRegisterExpense(participant)}> 등록
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </li>
                                    )
                                })}
                            </ul>

                        </article>

                        <div className="step2-bottom-actions">
                            <button type="button" className="btn btn-secondary back-button"
                                    onClick={() => setCurrentStep(1)}>
                                이전
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={goToStep3}>
                                다음
                            </button>
                        </div>
                    </>
                ) : null}

                {currentStep === 3 ? (
                    <>
                        <article className="step-card">
                            <h2>최종 정산 결과</h2>
                            <section className="receipt" aria-label="정산 영수증">
                                <button
                                    type="button"
                                    className="receipt-help-toggle"
                                    onClick={() => setShowReceiptHelp((prev) => !prev)}
                                    aria-label="계산 방식 설명 보기"
                                    aria-haspopup="true"
                                    aria-expanded={showReceiptHelp}
                                    aria-controls="receipt-help-popover"
                                >
                                    <img src={questionIcon} alt=""/>
                                </button>
                                {showReceiptHelp ? (
                                    <div id="receipt-help-popover" className="receipt-help-popover" role="status">
                                        <p className="receipt-help-popover-title">계산 로직</p>
                                        <ol>
                                            <li>각 참여자의 실제 결제 금액을 합산합니다.</li>
                                            <li>항목별 분배 편집기에서 설정한 사람별 금액(고정/비율/제외 반영)을 합산합니다.</li>
                                            <li>개인별 실제 결제액과 부담액의 차액을 계산합니다.</li>
                                            <li>보낼 사람과 받을 사람을 순차 매칭해 최종 송금 금액을 만듭니다.</li>
                                        </ol>
                                        <div className="receipt-help-breakdown">
                                            {participantTotals.map(({participant, items, total}) => (
                                                <p key={participant.id}>
                                                    {participant.name} : {items.length > 0
                                                    ? items.map((item) => formatAmount(item.amount)).join(' + ')
                                                    : '0'} = {formatAmount(total)}원
                                                </p>
                                            ))}
                                            <p>
                                                총 금액 : {participantTotals.length > 0
                                                ? participantTotals.map((item) => formatAmount(item.total)).join(' + ')
                                                : '0'} = {formatAmount(totalSpent)}원
                                            </p>
                                            <p>기준 부담 방식 : 항목별 분배 편집기 설정값 합산</p>
                                            <p className="receipt-help-breakdown-title">차액 계산</p>
                                            {participantTotals.map(({participant, total}) => {
                                                const target = settlementContext.targetByParticipantId[participant.id] ?? 0
                                                const diff = target - total
                                                const diffLabel = diff > 0 ? `${formatAmount(diff)}원` : `- ${formatAmount(Math.abs(diff))}원`
                                                return (
                                                    <p key={`${participant.id}-diff`}>
                                                        {participant.name} : {formatAmount(Math.round(target))} - {formatAmount(total)} = {diffLabel}
                                                    </p>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="receipt-header">
                                    <p className="receipt-title">PAY BALANCE RECEIPT</p>
                                    <p className="receipt-subtitle">정산 결과 영수증</p>
                                </div>

                                <div className="receipt-help-box">
                                    정산 방식: 항목 등록 시 기본은 균등(비율 1)으로 생성되고, 항목별 분배 편집기에서 고정/비율/제외를 조정합니다.
                                </div>

                                <div className="receipt-meta">
                                    <p>
                                        <span>참여 인원</span>
                                        <strong>{participants.length}명</strong>
                                    </p>
                                    <p>
                                        <span>총 지출 금액</span>
                                        <strong>{formatAmount(totalSpent)}원</strong>
                                    </p>
                                </div>

                                <div className="receipt-balance-list">
                                    <div className="receipt-balance-head">
                                        <span>이름</span>
                                        <span>실제 결제</span>
                                        <span>최종 부담</span>
                                        <span>차액</span>
                                    </div>
                                    {participantSettlementSummary.map((row) => (
                                        <div key={row.id} className="receipt-balance-row">
                                            <span>{row.name}</span>
                                            <span>{formatAmount(Math.round(row.paid))}원</span>
                                            <span>{formatAmount(Math.round(row.burden))}원</span>
                                            <span
                                                className={
                                                    row.diff > 0
                                                        ? 'is-positive'
                                                        : row.diff < 0
                                                            ? 'is-negative'
                                                            : ''
                                                }
                                            >
                                                {row.diff > 0 ? '+' : row.diff < 0 ? '-' : ''}
                                                {formatAmount(Math.round(Math.abs(row.diff)))}원
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="receipt-expense-list">
                                    <div className="receipt-expense-head">
                                        <span>결제자</span>
                                        <span>장소</span>
                                        <span>지불 금액</span>
                                    </div>

                                    {participants.length === 0 ? (
                                        <p className="empty-message receipt-empty-message">지출 내역이 없습니다.</p>
                                    ) : (
                                        participants.map((participant) => {
                                            const items = expenseList.filter((item) => item.participantId === participant.id)
                                            const total = items.reduce((sum, item) => sum + item.amount, 0)

                                            if (items.length === 0) {
                                                return (
                                                    <div key={`${participant.id}-total`}
                                                         className="receipt-expense-row receipt-expense-total-row">
                                                        <span>{participant.name}</span>
                                                        <span>합계</span>
                                                        <span>0원</span>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div key={participant.id}>
                                                    {items.map((item, index) => (
                                                        <div key={item.id} className="receipt-expense-row">
                                                            <span>{index === 0 ? participant.name : ''}</span>
                                                            <span>{item.source}</span>
                                                            <span>{formatAmount(item.amount)}원</span>
                                                        </div>
                                                    ))}

                                                    <div className="receipt-expense-row receipt-expense-total-row">
                                                        {/*<span>{participant.name}</span>*/}
                                                        {/*<span>합계</span>*/}
                                                        <span></span>
                                                        <span></span>
                                                        <span>{formatAmount(total)}원</span>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>

                                <div className="receipt-rule-list">
                                    <div className="receipt-rule-head">
                                        <span>항목</span>
                                        <span>제외</span>
                                        <span>고정</span>
                                        <span>{allocationInputMode === 'percent' ? '퍼센트' : '비율'}</span>
                                    </div>
                                    {expenseRuleSummaryRows.length === 0 ? (
                                        <p className="empty-message receipt-empty-message">분배 설정 내역이 없습니다.</p>
                                    ) : (
                                        expenseRuleSummaryRows.map((row) => (
                                            <div key={row.id} className="receipt-rule-row">
                                                <span>{row.source}</span>
                                                <span>{row.excludedText}</span>
                                                <span>{row.fixedText}</span>
                                                <span>{row.ratioText}</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="receipt-transfer-list">
                                    <div className="receipt-transfer-head">
                                        <span>보내는 사람</span>
                                        <span>받는 사람</span>
                                        <span>송금 금액</span>
                                    </div>
                                    {settlements.length === 0 ? (
                                        <p className="empty-message receipt-empty-message">정산 결과가 없습니다.</p>
                                    ) : (
                                        settlements.map((settlement, index) => (
                                            <div
                                                key={`${settlement.from}-${settlement.to}-${index}`}
                                                className="receipt-transfer-row"
                                            >
                                                <span>{settlement.from}</span>
                                                <span>{settlement.to}</span>
                                                <span>{formatAmount(Math.round(settlement.amount))}원</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </article>

                        <div className="step3-bottom-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
                                이전
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={shareTemporarily}>
                                공유하기 (임시)
                            </button>
                            <button type="button" className="btn" onClick={startNewCalculation}>
                                새로운 계산
                            </button>
                        </div>
                    </>
                ) : null}
            </section>
        </main>
    )
}

export default App
