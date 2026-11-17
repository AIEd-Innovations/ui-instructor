import { useCallback, useEffect, useState } from 'react';
import './index.css';
import MaterialPreview from './tabs/MaterialPreview';
import LabQuizPreview from './tabs/LabQuizPreview';
// Deactivated per Week 6 meeting (re-enable by uncommenting here, in `tabs`, and in renderContent)
// import StudentActivity from './tabs/StudentActivity';
import GradedSubmissions from './tabs/GradedSubmissions';
import Statistics from './tabs/Statistics';
// import AgentCollaboration from './tabs/AgentCollaboration';
import UploadMaterialModal from './components/UploadMaterialModal';
import AgentConfigModal from './components/AgentConfigModal';
import ApiKeyModal from './components/ApiKeyModal';
import StudentDetailModal from './components/StudentDetailModal';
import LoginPage from './components/LoginPage';
import CourseLabPicker, { FirstCourse } from './components/CourseLabPicker';
import { LabProvider } from './state/LabContext';
import { useLab } from './state/labStore';
import { SessionProvider } from './state/SessionContext';
import { useSession } from './state/sessionStore';
import { useLlmSettings } from './state/useLlmSettings';
import { clearLlmKey, hasLlmKey } from './api/llmKey';
import { signOut } from './auth/auth';
import type { SignedInUser } from './auth/auth';
import { formatSize, formatWhen, isConfigured } from './api/curriculum';
import { clearSession, onSignedOut } from './api/session';

type Tab = 'tasks' | 'quiz' | 'activity' | 'grades' | 'stats' | 'agents';

const tabs: { id: Tab; label: string }[] = [
  { id: 'tasks', label: 'Lab Tasks' },
  { id: 'quiz', label: 'Lab Quiz' },
  // { id: 'activity', label: 'Student Activity' }, // deactivated
  { id: 'grades', label: 'Student Submissions' },
  { id: 'stats', label: 'Statistics' },
  // { id: 'agents', label: 'AI Overview' }, // deactivated
];

/** Uploaded PDFs for this lab, straight from the agent. */
function MaterialFiles() {
  const { files, busy, deleteFile } = useLab();
  const [removing, setRemoving] = useState<string | null>(null);

  if (files.length === 0) {
    return <div className="uploaded-file uploaded-file--empty">No material uploaded yet</div>;
  }

  async function remove(fileId: string) {
    setRemoving(fileId);
    try {
      await deleteFile(fileId);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      {files.map(file => (
        <div className="uploaded-file" key={file.file_id}>
          <div className="file-name" title={file.filename}>{file.filename}</div>
          <div className="file-meta">
            {formatWhen(file.uploaded_at)} · {formatSize(file.size_bytes)}
          </div>
          <button
            className="file-remove"
            onClick={() => void remove(file.file_id)}
            disabled={busy || removing === file.file_id}
            aria-label={`Remove ${file.filename}`}
          >
            {removing === file.file_id ? '…' : '✕'}
          </button>
        </div>
      ))}
    </>
  );
}

function Dashboard({ user, onSignOut }: { user: SignedInUser; onSignOut: () => void }) {
  const { lab } = useLab();
  const { course } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [showUploadMaterial, setShowUploadMaterial] = useState(false);
  const [showAgentConfig, setShowAgentConfig] = useState(false);
  // Ask for the key right after sign-in, since every model request needs it.
  const [showApiKey, setShowApiKey] = useState(() => !hasLlmKey());
  const { apiKey } = useLlmSettings();
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function renderContent() {
    switch (activeTab) {
      case 'tasks': return <MaterialPreview />;
      case 'quiz': return <LabQuizPreview />;
      // case 'activity': return <StudentActivity onSelectStudent={setSelectedStudent} />;
      case 'grades': return <GradedSubmissions onSelectStudent={setSelectedStudent} />;
      case 'stats': return <Statistics />;
      // case 'agents': return <AgentCollaboration />;
    }
  }

  return (
    <>
      <div className="dashboard">
        <header className="header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)} title="Toggle sidebar">
            <span className="sidebar-toggle-bar" />
            <span className="sidebar-toggle-bar" />
            <span className="sidebar-toggle-bar" />
          </button>
          <div className="header-left">
            <h1>AI Ed Innovations</h1>
            <p>
              {course
                ? `${course.name}${lab ? ` — ${lab.title}` : ' — no lab generated yet'}`
                : 'No course yet'}
            </p>
          </div>
          <CourseLabPicker />
          <button
            className={`api-key-btn${apiKey ? ' api-key-btn--set' : ''}`}
            onClick={() => setShowApiKey(true)}
            title={apiKey ? 'Your API key is set for this tab' : 'Add your API key to run requests on your own account'}
          >
            {apiKey ? '● API key set' : 'Add API key'}
          </button>
          <span className="user-chip" title={user.email}>{user.name}</span>
          <button className="api-key-btn user-signout" onClick={onSignOut}>Sign out</button>
          {/* Placeholder, not hooked up to anything
          <div className="status-pill">● Lab in session</div> */}
        </header>

        {!isConfigured() && (
          <div className="notice config-banner">
            The Curriculum Designer is not connected yet, so lab generation is
            unavailable. (Developers: set <code>VITE_CURRICULUM_URL</code> — see{' '}
            <code>.env.example</code> — and redeploy.)
          </div>
        )}

        <div className="body">
          <aside className={`left-panel${sidebarOpen ? '' : ' left-panel--collapsed'}`}>
            <div className="panel-section-label">Lab Material</div>

            <MaterialFiles />

            <button className="panel-btn panel-btn-ghost" onClick={() => setShowUploadMaterial(true)}>
              Upload Material
            </button>
            <button className="panel-btn panel-btn-ghost" onClick={() => setShowAgentConfig(true)}>
              Customize Tutor Behavior
            </button>
          </aside>

          <main className="main">
            <div className="tab-bar">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="content-scroll">{renderContent()}</div>
          </main>
        </div>
      </div>

      {showUploadMaterial && <UploadMaterialModal onClose={() => setShowUploadMaterial(false)} />}
      {showApiKey && <ApiKeyModal onClose={() => setShowApiKey(false)} />}
      {showAgentConfig && <AgentConfigModal onClose={() => setShowAgentConfig(false)} />}
      {selectedStudent && (
        <StudentDetailModal
          studentName={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onViewSubmission={() => { setSelectedStudent(null); setActiveTab('grades'); }}
        />
      )}
    </>
  );
}

/**
 * Between sign-in and the dashboard: ask the Curriculum Designer who this is
 * (`GET /me`). A brand new instructor owns no course yet and has nowhere to put
 * a lab, so they name their first one before the dashboard appears.
 */
function AfterSignIn({ user, onSignOut }: { user: SignedInUser; onSignOut: () => void }) {
  const { courses, loading, error, reload } = useSession();

  if (loading) {
    return <div className="app-splash">Loading your courses…</div>;
  }

  if (error) {
    return (
      <div className="app-splash">
        <div className="notice notice-error">{error}</div>
        <button className="btn-outline" onClick={() => void reload()}>Try again</button>
        <button className="btn-outline" onClick={onSignOut}>Sign out</button>
      </div>
    );
  }

  if (courses.length === 0) {
    return <FirstCourse />;
  }

  return (
    <LabProvider>
      <Dashboard user={user} onSignOut={onSignOut} />
    </LabProvider>
  );
}

export default function App() {
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [expired, setExpired] = useState(false);

  const handleSignOut = useCallback(() => {
    // The key and the chosen course belong to whoever signed in, so they go too.
    clearLlmKey();
    clearSession();
    void signOut();
    setUser(null);
  }, []);

  // A token that expires while the dashboard is open: the next request comes
  // back 401, and the instructor is sent back here to sign in again.
  useEffect(() => {
    onSignedOut(() => {
      setExpired(true);
      handleSignOut();
    });
    return () => onSignedOut(null);
  }, [handleSignOut]);

  if (!user) {
    return (
      <>
        {expired && (
          <div className="notice notice-error app-expired">
            Your sign-in expired. Sign in again to continue.
          </div>
        )}
        <LoginPage
          onLogin={signedIn => {
            setExpired(false);
            setUser(signedIn);
          }}
        />
      </>
    );
  }

  return (
    <SessionProvider>
      <AfterSignIn user={user} onSignOut={handleSignOut} />
    </SessionProvider>
  );
}
