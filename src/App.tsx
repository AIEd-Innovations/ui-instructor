import { useEffect, useState } from 'react';
import './index.css';
import { approveLab, generateLab, getLab, requestChanges, uploadInstructions, uploadMaterial } from './api/curriculum';
import type { LabMaterial } from './api/curriculum';
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

type Tab = 'tasks' | 'quiz' | 'activity' | 'grades' | 'stats' | 'agents';

const tabs: { id: Tab; label: string }[] = [
  { id: 'tasks', label: 'Lab Tasks Preview' },
  { id: 'quiz', label: 'Lab Quiz Preview' },
  { id: 'activity', label: 'Student Activity' },
  { id: 'grades', label: 'Graded Submissions' },
  { id: 'stats', label: 'Statistics' },
  { id: 'agents', label: 'AI Overview' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [showUploadMaterial, setShowUploadMaterial] = useState(false);
  const [showUploadAgent, setShowUploadAgent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Curriculum designer state, shared by the sidebar and the Lab Tasks / Lab Quiz tabs.
  const [lab, setLab] = useState<LabMaterial | null>(null);
  const [labBusy, setLabBusy] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  // True once the agent has actually received materialFile (it is held locally until a lab exists).
  const [materialSent, setMaterialSent] = useState(false);

  useEffect(() => {
    getLab()
      .then(setLab)
      .catch(e => setLabError(e instanceof Error ? e.message : 'Request failed'));
  }, []);

  /** Runs an agent call, stores the resulting lab, and reports whether it succeeded. */
  async function runLabAction(action: () => Promise<LabMaterial>): Promise<boolean> {
    setLabBusy(true);
    setLabError(null);
    try {
      setLab(await action());
      return true;
    } catch (e) {
      setLabError(e instanceof Error ? e.message : 'Request failed');
      return false;
    } finally {
      setLabBusy(false);
    }
  }

  async function handleGenerate(title: string, learningObjectives: string[]) {
    const ok = await runLabAction(() => generateLab({ title, learningObjectives, file: materialFile ?? undefined }));
    if (ok && materialFile) setMaterialSent(true);
    return ok;
  }

  async function handleMaterialUploaded(file: File) {
    if (labBusy) return; // the sidebar buttons are disabled while busy; this guards the modal that was already open
    if (!lab) {
      // The agent stores material on an existing lab, so hold the file until the lab is generated.
      setMaterialFile(file);
      setMaterialSent(false);
      return;
    }
    // With a lab already generated, store the PDF and regenerate so the material is applied.
    const ok = await runLabAction(async () => {
      await uploadMaterial(file);
      return generateLab({ title: lab.title, learningObjectives: lab.learning_objectives });
    });
    if (ok) {
      setMaterialFile(file);
      setMaterialSent(true);
    }
  }

  function renderContent() {
    switch (activeTab) {
      case 'tasks':
        return <MaterialPreview lab={lab} busy={labBusy} error={labError} onGenerate={handleGenerate} onApprove={() => runLabAction(approveLab)} />;
      case 'quiz':
        return <LabQuizPreview lab={lab} busy={labBusy} error={labError} onApprove={() => runLabAction(approveLab)} onRequestChanges={fb => runLabAction(() => requestChanges(fb))} />;
      case 'activity': return <StudentActivity onSelectStudent={setSelectedStudent} />;
      case 'grades': return <GradedSubmissions onSelectStudent={setSelectedStudent} />;
      case 'stats': return <Statistics />;
      case 'agents': return <AgentCollaboration />;
    }
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <>
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)} title="Toggle sidebar">
          <span className="sidebar-toggle-bar" />
          <span className="sidebar-toggle-bar" />
          <span className="sidebar-toggle-bar" />
        </button>
        <div className="header-left">
          <h1>Instructor Panel</h1>
          <p>CSC 101 — Lab 4: Linked Lists</p>
        </div>
        <div className="status-pill">● Lab in session</div>
      </header>

      {/* Body */}
      <div className="body">
        {/* Left Panel */}
        <aside className={`left-panel${sidebarOpen ? '' : ' left-panel--collapsed'}`}>
          <div className="panel-section-label">Lab Material</div>

          <button className="panel-btn panel-btn-ghost" disabled={labBusy} onClick={() => setShowUploadMaterial(true)}>Upload Material</button>
          <button className="panel-btn panel-btn-ghost" disabled={labBusy} onClick={() => setShowUploadAgent(true)}>Customize Tutor Behavior</button>

          {/* Materials list sits below the buttons so the buttons stay put as materials grow */}
          <div className="uploaded-file">
            {materialFile ? (
              <>
                <div className="file-name">{materialFile.name}</div>
                <div className="file-meta">
                  {materialSent ? 'Uploaded' : 'Not sent yet: used when you generate the lab'} · {(materialFile.size / 1024).toFixed(0)} KB
                </div>
              </>
            ) : lab?.material_content ? (
              <div className="file-name">Material uploaded</div>
            ) : (
              <div className="file-meta">No material uploaded</div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          {/* Tab Bar */}
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

          {/* Content */}
          <div className="content-scroll">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>

    {showUploadMaterial && <UploadMaterialModal
      willRegenerate={lab !== null}
      onUploaded={file => void handleMaterialUploaded(file)}
      onClose={() => setShowUploadMaterial(false)}
    />}
    {showUploadAgent && (
      <UploadAgentModal
        labExists={lab !== null}
        onSave={uploadInstructions}
        onClose={() => setShowUploadAgent(false)}
      />
    )}
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
