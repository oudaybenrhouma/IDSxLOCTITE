import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, useApi, ApiError } from '../api.js';
import { Alert, Badge, Loading, Reveal } from '../components/UI.jsx';
import { Mascot } from '../components/Mascot.jsx';
import AssessmentView from '../components/AssessmentView.jsx';
import { useToast } from '../components/Toast.jsx';

/**
 * The guide asks one thing at a time. Steps that are not needed are skipped, and
 * every explanatory paragraph lives behind a “Why?” disclosure so the screen
 * holds a single question and a single way forward.
 */

const emptyState = {
  entry: null,
  problemId: null,
  applicationId: null,
  entryQuestionId: null,
  entryOptionIndex: null,
  questionId: null,
  optionIndex: null,
  answers: {},
};

export default function GuidedSelection() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const questions = useApi(() => api.questions(), []);
  const problems = useApi(() => api.problems(), []);
  const applications = useApi(() => api.applications(), []);

  const [state, setState] = useState(() => ({ ...emptyState, ...(location.state || {}) }));
  const [step, setStep] = useState(() => {
    const st = location.state || {};
    if (st.problemId) return 'criteria';
    if (st.applicationId) return 'questions';
    return 'start';
  });
  const [history, setHistory] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loading = questions.loading || problems.loading || applications.loading;
  const loadError = questions.error || problems.error || applications.error;

  const qList = questions.data?.questions || [];
  const questionById = useMemo(() => new Map(qList.map((q) => [q.question_id, q])), [qList]);
  const root = qList.find((q) => q.question_id === (questions.data?.rootQuestionId || 'Q1_APPLICATION_TYPE'));
  const currentQuestion = state.questionId ? questionById.get(state.questionId) : null;

  const runAssessment = useCallback(async (nextState) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.recommend({
        problemId: nextState.problemId || undefined,
        applicationId: nextState.applicationId || undefined,
        questionId: nextState.questionId || undefined,
        optionIndex: Number.isInteger(nextState.optionIndex) ? nextState.optionIndex : undefined,
        entryQuestionId: nextState.entryQuestionId || undefined,
        entryOptionIndex: Number.isInteger(nextState.entryOptionIndex) ? nextState.entryOptionIndex : undefined,
        answers: nextState.answers,
      });
      setAssessment(res);
      setStep('result');
      setParams((p) => {
        const np = new URLSearchParams(p);
        if (nextState.applicationId) np.set('application', nextState.applicationId); else np.delete('application');
        if (nextState.problemId) np.set('problem', nextState.problemId); else np.delete('problem');
        return np;
      }, { replace: true });
      if (res.status === 'recommendation' && res.primary) {
        toast.push({
          title: 'We found a match',
          message: `${res.primary.resolution.product?.name || res.primary.productId} — check the notes before you apply it.`,
        });
      }
    } catch (err) {
      setError(err);
      setAssessment(null);
      toast.push({ tone: 'error', title: 'We could not finish that', message: err.message });
    } finally {
      setBusy(false);
    }
  }, [setParams, toast]);

  const go = (nextState, nextStep) => {
    setHistory((h) => [...h, { state, step }]);
    setState(nextState);
    setStep(nextStep);
    setAssessment(null);
  };

  const back = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setState(last.state);
      setStep(last.step);
      setAssessment(null);
      return h.slice(0, -1);
    });
  };

  const restart = () => {
    setState(emptyState);
    setStep('start');
    setHistory([]);
    setAssessment(null);
    setError(null);
    setParams(new URLSearchParams(), { replace: true });
    toast.push({ tone: 'info', title: 'Starting again', message: 'Your previous answers have been cleared.' });
  };

  const selectBranch = (index, opt) => {
    const next = {
      ...state,
      entry: 'application',
      entryQuestionId: root.question_id,
      entryOptionIndex: index,
      questionId: opt.next && questionById.has(opt.next) ? opt.next : null,
      optionIndex: null,
      answers: {},
    };
    if (next.questionId) go(next, 'questions');
    else { go(next, 'result'); runAssessment(next); }
  };

  const selectOption = (index) => {
    const next = { ...state, optionIndex: index };
    go(next, 'result');
    runAssessment(next);
  };

  const startFromProblem = (problemId) => {
    const pr = (problems.data?.problems || []).find((p) => p.id === problemId);
    go({ ...emptyState, entry: 'problem', problemId, applicationId: pr?.applicationId || null, answers: {} }, 'criteria');
  };

  const startFromApplication = (applicationId) => {
    const app = (applications.data?.applications || []).find((a) => a.id === applicationId);
    const qid = app?.questionIds?.[0];
    if (qid && questionById.has(qid)) go({ ...emptyState, entry: 'application', applicationId, questionId: qid }, 'questions');
    else go({ ...emptyState, entry: 'application', applicationId }, 'criteria');
  };

  const setAnswer = (key, value) => {
    setState((s) => {
      const answers = { ...s.answers };
      if (value === undefined || value === null || value === '') delete answers[key];
      else answers[key] = value;
      return { ...s, answers };
    });
  };

  const criteriaInputs = useMemo(
    () => (assessment ? assessment.missingInfo.filter((m) => m.type !== 'notice') : []),
    [assessment],
  );

  if (loading) return <div className="container"><Loading label="Getting the questions ready…" /></div>;
  if (loadError) {
    return (
      <div className="container">
        <Alert tone="danger" title="The questions are not available right now">{loadError.message}</Alert>
      </div>
    );
  }

  /* Progress: three taps maximum, so we only ever show three steps. */
  const stepIndex = { start: 0, problem: 0, questions: 1, criteria: 1, result: 2 }[step] ?? 0;
  const STEP_LABELS = ['What are you doing?', 'A few details', 'Your product'];

  return (
    <div className="container container-narrow">
      <div className="row-between mb-2 no-print">
        <div className="row" style={{ gap: 8 }}>
          {history.length ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={back}>← Back</button>
          ) : null}
          {step !== 'start' ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>Start again</button>
          ) : null}
        </div>
        <Badge tone="outline">Step {stepIndex + 1} of 3</Badge>
      </div>

      <div className="progress mb-3" aria-hidden="true">
        <span style={{ width: `${((stepIndex + 1) / 3) * 100}%` }} />
      </div>
      <p className="visually-hidden">Step {stepIndex + 1} of 3: {STEP_LABELS[stepIndex]}</p>

      {busy ? <Loading label="Checking the documentation…" /> : null}

      {error && !busy ? (
        <Alert
          tone="danger"
          title={error instanceof ApiError && error.code === 'REPONSES_INVALIDES' ? 'Some answers need a second look' : 'We could not finish that'}
        >
          <p>{error.message}</p>
          {error.payload?.problems ? <ul>{error.payload.problems.map((p, i) => <li key={i}>{p.message}</li>)}</ul> : null}
        </Alert>
      ) : null}

      {/* ------------------------------- 1 · Start ------------------------------- */}
      {step === 'start' && !busy ? (
        <div className="card">
          <div className="mascot-figure mb-2">
            <Mascot pose="neutral" size={120} decorative className="mascot--optional" />
            <div className="mascot-figure__body">
              <h1 style={{ fontSize: '1.7rem' }}>What are you working on?</h1>
              <p className="muted" style={{ margin: 0 }}>Two quick questions and you get a product with the reason why.</p>
            </div>
          </div>

          <div className="options">
            <button type="button" className="option" onClick={() => setStep('problem')}>
              <span className="option-check" aria-hidden="true">🛠️</span>
              <span className="option-main">
                <span className="option-label">Something is wrong</span>
                <span className="option-meta">Loosening, leakage, wear, seizing — start from the symptom.</span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="option" onClick={() => setStep('questions')}>
              <span className="option-check" aria-hidden="true">🧭</span>
              <span className="option-main">
                <span className="option-label">I know the type of job</span>
                <span className="option-meta">Fastening, sealing, flanges, bearings, pumps, bonding.</span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="option" onClick={() => navigate('/recherche')}>
              <span className="option-check" aria-hidden="true">🔍</span>
              <span className="option-main">
                <span className="option-label">I already know the product</span>
                <span className="option-meta">Search by name, code or approval instead.</span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="mt-2">
            <Reveal title="How the guide chooses" flat>
              The guide follows the documented selection rules in the supplied Henkel datasets. Each question comes
              from the documented questionnaire, and each answer is backed by a rule branch and its source pages.
              Where the documentation does not decide, it tells you instead of guessing.
            </Reveal>
          </div>
        </div>
      ) : null}

      {/* ------------------------------ Problem ------------------------------ */}
      {step === 'problem' && !busy ? (
        <div className="card">
          <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>What are you seeing?</h1>
          <p className="muted small" style={{ marginTop: 0 }}>Pick the closest symptom. You can go back at any time.</p>
          <div className="options">
            {(problems.data?.problems || []).map((p) => (
              <button key={p.id} type="button" className="option" onClick={() => startFromProblem(p.id)}>
                <span className="option-main">
                  <span className="option-label">{p.title}</span>
                  <span className="option-meta">{p.symptoms}</span>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* --------------------------- Documented Q1 --------------------------- */}
      {step === 'questions' && !busy && !currentQuestion && root ? (
        <div className="card">
          <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>{root.text}</h1>
          <p className="muted small" style={{ marginTop: 0 }}>Pick the one that matches your job.</p>
          <div className="options">
            {root.options.map((opt, i) => (
              <button key={i} type="button" className="option" onClick={() => selectBranch(i, opt)}>
                <span className="option-main">
                  <span className="option-label">{opt.label}</span>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <div className="mt-2">
            <Reveal title="Or jump straight to a documented application" flat>
              <div className="chips">
                {(applications.data?.applications || []).map((a) => (
                  <button key={a.id} type="button" className="chip" onClick={() => startFromApplication(a.id)}>
                    {a.title}
                  </button>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      ) : null}

      {/* --------------------------- Documented Q2 --------------------------- */}
      {step === 'questions' && !busy && currentQuestion ? (
        <div className="card">
          <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>{currentQuestion.text}</h1>
          {state.entryOptionIndex !== null && root ? (
            <p className="muted small" style={{ marginTop: 0 }}>
              {root.options[state.entryOptionIndex]?.label}
            </p>
          ) : null}
          <div className="options mt-2">
            {currentQuestion.options.map((opt, i) => (
              <button key={i} type="button" className="option" onClick={() => selectOption(i)}>
                <span className="option-main">
                  <span className="option-label">{opt.label}</span>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <div className="mt-2">
            <Reveal title="Rather answer with technical values?" flat>
              <p className="small muted" style={{ marginTop: 0 }}>
                You can give a measured temperature or gap instead of picking a documented answer. The guide then
                checks each candidate against its own documented limits.
              </p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setStep('criteria')}>
                Enter technical values
              </button>
            </Reveal>
          </div>
        </div>
      ) : null}

      {/* ----------------------------- Criteria ----------------------------- */}
      {step === 'criteria' && !busy ? (
        <div className="stack">
          <div className="card">
            <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>Two details, then we check</h1>
            <p className="muted small" style={{ marginTop: 0 }}>
              Service temperature and anything hazardous in the fluid. Both are optional, but they make the answer
              much safer.
            </p>
            <div className="stack mt-2" style={{ gap: 20 }}>
              {defaultCriteria().map((spec) => (
                <CriteriaInput
                  key={spec.key}
                  spec={spec}
                  value={state.answers[spec.key] ?? ''}
                  onChange={(v) => setAnswer(spec.key, v)}
                />
              ))}
            </div>
            <div className="answer-actions mt-2">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => runAssessment(state)}>
                Show my product
              </button>
              {Object.keys(state.answers).length ? (
                <button type="button" className="btn btn-ghost" onClick={() => setState((s) => ({ ...s, answers: {} }))}>
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ------------------------------ Result ------------------------------ */}
      {step === 'result' && !busy && assessment ? (
        <div className="stack">
          <AssessmentView
            result={assessment}
            onAdjust={() => setStep('criteria')}
            onCompare={(ids) => navigate(`/comparer?ids=${ids.join(',')}`)}
          />

          {criteriaInputs.length ? (
            <Reveal title="Improve this answer" hint="a couple of values can settle it">
              <p className="small muted" style={{ marginTop: 0 }}>
                The documentation needs one more detail to be sure. Adding it takes a few seconds.
              </p>
              <div className="stack" style={{ gap: 18 }}>
                {criteriaInputs.map((m) => (
                  <CriteriaInput
                    key={m.key}
                    spec={m}
                    value={m.key === 'temp' ? state.answers.operatingTempC ?? '' : state.answers[m.key] ?? ''}
                    onChange={(v) => setAnswer(m.key === 'temp' ? 'operatingTempC' : m.key, v)}
                  />
                ))}
                <div className="row">
                  <button type="button" className="btn btn-primary" onClick={() => runAssessment(state)}>
                    Update the result
                  </button>
                </div>
              </div>
            </Reveal>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The two values that decide most cases. Everything else is asked only when needed. */
const defaultCriteria = () => [
  {
    key: 'operatingTempC',
    label: 'How hot does it get?',
    question: 'Continuous service temperature, in °C. Leave empty if you are not sure.',
    type: 'threshold',
    unit: '°C',
    options: [
      { value: 20, label: 'Room temperature' },
      { value: 90, label: 'Up to 150 °C' },
      { value: 180, label: '150–204 °C' },
      { value: 260, label: 'Above 204 °C' },
    ],
  },
  {
    key: 'operatingEnv',
    label: 'Anything hazardous in the fluid?',
    question: 'Some Loctite products must never be used with pure oxygen or oxidisers.',
    type: 'single',
    options: [
      { value: 'none', label: 'No — oil, water, air, hydraulic fluid' },
      { value: 'oxygen', label: 'Pure oxygen, chlorine or a strong oxidiser' },
      { value: 'plastic_threads', label: 'Plastic threads (ABS, PC, PVC)' },
      { value: 'unknown', label: 'I do not know' },
    ],
  },
];

function CriteriaInput({ spec, value, onChange }) {
  if (!spec) return null;

  if (spec.type === 'boolean') {
    return (
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 4 }}>{spec.label}</legend>
        <p className="small muted" style={{ marginTop: 0 }}>{spec.question}</p>
        <div className="chips">
          {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              className="chip"
              aria-pressed={value === o.v}
              onClick={() => onChange(value === o.v ? undefined : o.v)}
            >
              {o.l}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  if (spec.type === 'threshold') {
    const fieldId = `threshold-${spec.key}`;
    return (
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 4 }}>{spec.label}</legend>
        <p className="small muted" style={{ marginTop: 0 }}>{spec.question}</p>
        <div className="chips mb-2">
          {(spec.options || []).map((o) => (
            <button
              key={o.value}
              type="button"
              className="chip"
              aria-pressed={String(value) === String(o.value)}
              onClick={() => onChange(String(value) === String(o.value) ? undefined : o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="row">
          <label className="small" htmlFor={fieldId}>Or type the value ({spec.unit || 'value'})</label>
          <input
            id={fieldId}
            className="input"
            style={{ maxWidth: 180 }}
            type="number"
            step="0.01"
            inputMode="decimal"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className="label" style={{ marginBottom: 4 }}>{spec.label}</legend>
      <p className="small muted" style={{ marginTop: 0 }}>{spec.question}</p>
      <div className="options">
        {(spec.options || []).map((o) => (
          <button
            key={o.value}
            type="button"
            className="option"
            style={{ minHeight: 56 }}
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? undefined : o.value)}
          >
            <span className="option-main"><span className="option-label">{o.label}</span></span>
            <span className="option-check" aria-hidden="true">{value === o.value ? '✓' : ''}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
