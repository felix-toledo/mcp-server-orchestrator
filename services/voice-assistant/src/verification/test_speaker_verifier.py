import numpy as np
import torch

from verification.speaker_verifier import SpeakerVerifier, pcm_bytes_to_tensor


class FakeSpeakerRecognition:
    def __init__(self, prediction: bool):
        self.prediction = prediction
        self.calls = []

    def verify_batch(self, captured_signal, enrollment_signal):
        self.calls.append((captured_signal, enrollment_signal))
        return 0.9, self.prediction


def make_pcm_bytes(n_samples: int = 100) -> bytes:
    return (np.arange(n_samples, dtype=np.int16) % 1000).tobytes()


def test_verify_returns_true_on_match(mocker):
    speaker_recognition = FakeSpeakerRecognition(prediction=True)
    verifier = SpeakerVerifier(speaker_recognition)
    enrollment_tensor = torch.zeros(1, 16000)
    mocker.patch(
        "verification.speaker_verifier.load_and_normalize",
        return_value=enrollment_tensor,
    )

    result = verifier.verify(make_pcm_bytes(), "C:\\voice-profile\\sample.wav")

    assert result is True
    assert len(speaker_recognition.calls) == 1
    captured_arg, enrollment_arg = speaker_recognition.calls[0]
    assert isinstance(captured_arg, torch.Tensor)
    assert captured_arg.shape[0] == 1
    assert enrollment_arg is enrollment_tensor


def test_verify_returns_false_on_no_match(mocker):
    speaker_recognition = FakeSpeakerRecognition(prediction=False)
    verifier = SpeakerVerifier(speaker_recognition)
    mocker.patch(
        "verification.speaker_verifier.load_and_normalize",
        return_value=torch.zeros(1, 16000),
    )

    result = verifier.verify(make_pcm_bytes(), "C:\\voice-profile\\sample.wav")

    assert result is False


def test_verify_short_circuits_to_false_when_no_enrollment_path(mocker):
    speaker_recognition = mocker.Mock()
    verifier = SpeakerVerifier(speaker_recognition)

    result = verifier.verify(make_pcm_bytes(), None)

    assert result is False
    speaker_recognition.verify_batch.assert_not_called()


def test_pcm_bytes_to_tensor_normalizes_int16_to_float32_batched():
    pcm = np.array([0, 16384, -16384, 32767], dtype=np.int16).tobytes()

    tensor = pcm_bytes_to_tensor(pcm)

    assert tensor.shape == (1, 4)
    assert tensor.dtype == torch.float32
    assert tensor[0, 0].item() == 0.0
    assert abs(tensor[0, 1].item() - 0.5) < 0.001
