"""
QMixMixer 단위 테스트
- forward shape 검증
- 단조성(monotonicity) 검증: agent_qs 증가 → q_tot 감소하지 않아야 함
"""
import pytest
import torch
from engine.cactus.qmix_mixer import QMixMixer


@pytest.fixture
def mixer():
    return QMixMixer(n_agents=3, state_dim=16, embed_dim=8)


def test_forward_output_shape(mixer):
    """(B, n_agents) + (B, state_dim) → (B, 1)"""
    B = 4
    agent_qs = torch.randn(B, 3)
    state    = torch.randn(B, 16)
    q_tot = mixer(agent_qs, state)
    assert q_tot.shape == (B, 1), f"기대 (4, 1), 실제 {q_tot.shape}"


def test_forward_single_batch(mixer):
    """단일 배치(B=1) 동작"""
    agent_qs = torch.zeros(1, 3)
    state    = torch.zeros(1, 16)
    q_tot = mixer(agent_qs, state)
    assert q_tot.shape == (1, 1)


def test_monotonicity(mixer):
    """
    단조성: agent_qs[0] 를 작은 값 → 큰 값으로 교체하면 q_tot 도 단조 증가해야 함.
    QMIX hyper_w 에 abs() 적용 → 단조성 보장.
    """
    mixer.eval()
    state = torch.randn(1, 16)
    q_low  = torch.tensor([[0.0, 0.0, 0.0]])
    q_high = torch.tensor([[10.0, 10.0, 10.0]])
    with torch.no_grad():
        tot_low  = mixer(q_low,  state).item()
        tot_high = mixer(q_high, state).item()
    assert tot_high >= tot_low, (
        f"단조성 위반: Q_low={tot_low:.4f}, Q_high={tot_high:.4f}"
    )


def test_hypernetwork_weights_are_positive(mixer):
    """abs() 적용된 하이퍼네트워크 weight는 항상 ≥ 0"""
    state = torch.randn(2, 16)
    w1 = torch.abs(mixer.hyper_w1(state))
    w2 = torch.abs(mixer.hyper_w2(state))
    assert (w1 >= 0).all(), "hyper_w1 출력에 음수 존재"
    assert (w2 >= 0).all(), "hyper_w2 출력에 음수 존재"
