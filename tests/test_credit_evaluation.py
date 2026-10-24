import pytest

from app.services.credit_evaluation import status_for_score


@pytest.mark.parametrize(
    ("score", "status"),
    [
        (0, "REJECTED"),
        (39, "REJECTED"),
        (40, "MANUAL_REVIEW"),
        (89, "MANUAL_REVIEW"),
        (90, "APPROVED"),
        (100, "APPROVED"),
    ],
)
def test_score_thresholds(score: int, status: str) -> None:
    assert status_for_score(score) == status


@pytest.mark.parametrize("score", [-1, 101])
def test_score_outside_range_is_rejected(score: int) -> None:
    with pytest.raises(ValueError, match="between 0 and 100"):
        status_for_score(score)
