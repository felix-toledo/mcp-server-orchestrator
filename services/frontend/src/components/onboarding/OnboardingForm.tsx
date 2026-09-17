'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitOnboarding, type OnboardingFormState } from '../../actions/submit-onboarding';

// Not exported from submit-onboarding.ts: a 'use server' file may only
// export async functions, never a plain value like an initial state object.
const initialOnboardingFormState: OnboardingFormState = { status: 'idle' };

const PURPOSE_OPTIONS = [
  { value: 'PERSONAL_DAILY', label: 'Día a día personal (recordatorios, notas, organización)' },
  { value: 'AUTOMATION_PRODUCTIVITY', label: 'Automatizaciones y productividad' },
  { value: 'PROJECTS_WORK', label: 'Proyectos y trabajo' },
  { value: 'SECOND_BRAIN_STUDY', label: 'Segundo cerebro / estudio e investigación' },
  { value: 'TEAM_BUSINESS', label: 'Uso en equipo o empresa' },
] as const;

export function OnboardingForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitOnboarding, initialOnboardingFormState);

  useEffect(() => {
    if (state.status === 'success') {
      router.push('/');
    }
  }, [state.status, router]);

  return (
    <form action={formAction} className="onboarding-form">
      <div className="onboarding-form__heading">
        <h1 className="onboarding-form__title">bienvenido a alma</h1>
        <p className="onboarding-form__subtitle">contame quién sos y para qué querés usarme.</p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="name">
          Nombre
        </label>
        <input id="name" className="input" name="name" type="text" required />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="email">
          Email
        </label>
        <input id="email" className="input" name="email" type="email" required />
      </div>

      <fieldset>
        <legend>¿Para qué querés usar ALMA?</legend>
        {PURPOSE_OPTIONS.map((option) => (
          <label key={option.value} className="onboarding-form__radio">
            <input type="radio" name="purpose" value={option.value} required />
            {option.label}
          </label>
        ))}
      </fieldset>

      {state.status === 'error' && (
        <p role="alert" className="alert alert--danger">
          <span className="alert__icon" aria-hidden="true">
            ⚠
          </span>
          {state.error}
        </p>
      )}

      <button type="submit" className="btn btn--primary" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Empezar'}
      </button>
    </form>
  );
}
