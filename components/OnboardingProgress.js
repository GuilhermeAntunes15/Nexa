export default function OnboardingProgress({ step, total = 7 }) {
  const percentage = Math.min(100, Math.max(0, (step / total) * 100));

  return (
    <div className="onboarding-progress" aria-label={`Etapa ${step} de ${total}`}>
      <div className="onboarding-progress-copy">
        <span>Etapa {step} de {total}</span>
        <strong>{Math.round(percentage)}%</strong>
      </div>

      <div className="onboarding-progress-track">
        <div
          className="onboarding-progress-bar"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
