import { useState } from 'react';
import Modal from './Modal';
import { LLM_MODELS, clearLlmKey, setLlmSettings, vendorOf } from '../api/llmKey';
import { useLlmSettings } from '../state/useLlmSettings';

interface Props {
  onClose: () => void;
}

const VENDOR_NAMES = { anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Google' } as const;

export default function ApiKeyModal({ onClose }: Props) {
  const saved = useLlmSettings();
  const [key, setKey] = useState('');
  const [modelId, setModelId] = useState(saved.modelId);
  const vendor = vendorOf(modelId);

  function save() {
    // An empty field keeps the key that is already set; use "Remove key" to clear it.
    setLlmSettings({ modelId, ...(key.trim() ? { apiKey: key } : {}) });
    onClose();
  }

  return (
    <Modal title="Your API key" onClose={onClose}>
      <p className="modal-subtitle">
        Generating labs, requesting changes, proofreading and regrading run on your own model account.
        The key is sent with each of those requests and nowhere else.
      </p>

      <div className="llm-field">
        <label htmlFor="llm-model">Model</label>
        <select id="llm-model" value={modelId} onChange={e => setModelId(e.target.value)}>
          {LLM_MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({VENDOR_NAMES[m.vendor]})</option>
          ))}
        </select>
        <small>Used by the Curriculum Designer. The Assessment Agent grades with the model set on the assignment.</small>
      </div>

      <div className="llm-field">
        <label htmlFor="llm-key">{vendor ? `${VENDOR_NAMES[vendor]} API key` : 'API key'}</label>
        <input
          id="llm-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder={saved.apiKey ? '•••••••• (key is set — type to replace it)' : 'Paste your key'}
        />
        <small>
          Kept in this browser tab's memory only. It is never saved, logged or shown again, and it is
          forgotten when you reload or close the tab.
        </small>
      </div>

      <div className="notice notice-info">
        The key must be for the vendor of the model it is used with. Without a key, the servers use their
        built-in default, which may be a demo model.
      </div>

      <div className="modal-footer">
        {saved.apiKey && (
          <button className="btn-outline" onClick={() => { clearLlmKey(); setKey(''); }}>Remove key</button>
        )}
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}
