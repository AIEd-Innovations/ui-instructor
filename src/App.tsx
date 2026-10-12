import { useState } from 'react';
import './index.css';
import MaterialPreview from './tabs/MaterialPreview';
import LabQuizPreview from './tabs/LabQuizPreview';
import StudentActivity from './tabs/StudentActivity';
import GradedSubmissions from './tabs/GradedSubmissions';
import Statistics from './tabs/Statistics';
import AgentCollaboration from './tabs/AgentCollaboration';
import UploadMaterialModal from './components/UploadMaterialModal';
import UploadAgentModal from './components/UploadAgentModal';
import StudentDetailModal from './components/StudentDetailModal';
import LoginPage from './components/LoginPage';
import { LabProvider } from './state/LabContext';
import { useLab } from './state/labStore';
import { COURSE_ID, formatSize, formatWhen, isConfigured } from './api/curriculum';

type Tab = 'tasks' | 'quiz' | 'activity' | 'grades' | 'stats' | 'agents';

const tabs: { id: Tab; label: string }[] = [
  { id: 'tasks', label: 'Lab Tasks Preview' },
  { id: 'quiz', label: 'Lab Quiz Preview' },
  { id: 'activity', label: 'Student Activity' },
  { id: 'grades', label: 'Graded Submissions' },
  { id: 'stats', label: 'Statistics' },
  { id: 'agents', label: 'AI Overview' },
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

function Dashboard() {
  const { lab } = useLab();
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [showUploadMaterial, setShowUploadMaterial] = useState(false);
  const [showUploadAgent, setShowUploadAgent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function renderContent() {
    switch (activeTab) {
      case 'tasks': return <MaterialPreview />;
      case 'quiz': return <LabQuizPreview />;
      case 'activity': return <StudentActivity onSelectStudent={setSelectedStudent} />;
      case 'grades': return <GradedSubmissions onSelectStudent={setSelectedStudent} />;
      case 'stats': return <Statistics />;
      case 'agents': return <AgentCollaboration />;
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
            <h1>Instructor Panel</h1>
            <p>
              {lab
                ? `${lab.course_id.toUpperCase()} — ${lab.title}`
                : `${COURSE_ID.toUpperCase()} — no lab generated yet`}
            </p>
          </div>
          <div className="status-pill">● Lab in session</div>
        </header>

        {!isConfigured() && (
          <div className="notice notice-error config-banner">
            VITE_CURRICULUM_URL is not set, so this UI cannot reach the Curriculum
            Designer. Copy <code>.env.example</code> to <code>.env</code> and set it.
          </div>
        )}

        <div className="body">
          <aside className={`left-panel${sidebarOpen ? '' : ' left-panel--collapsed'}`}>
            <div className="panel-section-label">Lab Material</div>

            <MaterialFiles />

            <button className="panel-btn panel-btn-ghost" onClick={() => setShowUploadMaterial(true)}>
              Upload Material
            </button>
            <button className="panel-btn panel-btn-ghost" onClick={() => setShowUploadAgent(true)}>
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
      {showUploadAgent && <UploadAgentModal onClose={() => setShowUploadAgent(false)} />}
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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <LabProvider>
      <Dashboard />
    </LabProvider>
  );
}
