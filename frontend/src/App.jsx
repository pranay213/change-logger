import { useState } from 'react';
import { Search, Download, GitBranch } from 'lucide-react';
import { fetchChangelog, fetchBranches } from './services/api';
import CommitTable from './components/CommitTable';
import ChangelogGenerator from './components/ChangelogGenerator';

function App() {
  const [repoInput, setRepoInput] = useState('');
  const [activeRepo, setActiveRepo] = useState(null);
  const [activeBranch, setActiveBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [activeTab, setActiveTab] = useState('commits');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  const cleanRepoUrl = (input) => {
    let cleanedRepo = input.trim();
    if (cleanedRepo.endsWith('/')) cleanedRepo = cleanedRepo.slice(0, -1);
    if (cleanedRepo.includes('github.com/')) cleanedRepo = cleanedRepo.split('github.com/')[1];
    return cleanedRepo;
  }

  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanedRepo = cleanRepoUrl(repoInput);
    if (cleanedRepo && cleanedRepo.includes('/')) {
      setActiveRepo(cleanedRepo);
      setRepoInput(cleanedRepo);
      setActiveBranch('');
      
      try {
        setIsLoadingBranches(true);
        const fetchedBranches = await fetchBranches(cleanedRepo);
        setBranches(fetchedBranches);
      } catch (err) {
        console.error('Failed to fetch branches', err);
        setBranches([]);
      } finally {
        setIsLoadingBranches(false);
      }
    } else {
      alert('Please enter a valid owner/repo format');
    }
  };

  const handleDownload = async () => {
    const cleanedRepo = cleanRepoUrl(repoInput);
    if (!cleanedRepo || !cleanedRepo.includes('/')) {
      alert('Please enter a valid owner/repo to download the changelog');
      return;
    }
    try {
      setIsDownloading(true);
      // Generates the file dynamically directly in the backend
      await fetchChangelog(cleanedRepo, activeBranch);
      
      // Auto-trigger the download by opening the static public path
      const link = document.createElement('a');
      link.href = 'http://localhost:3001/public/versionsFrontend.ts';
      link.download = 'versionsFrontend.ts';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to generate and download file: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1 className="app-title">GitHub Commit Explorer</h1>
        <p className="app-subtitle">Instantly view history and generate changelogs for any public repository.</p>
      </header>

      <form className="search-container" onSubmit={handleSearch}>
        <input
          type="text"
          className="search-input"
          placeholder="fb55/htmlparser2 or facebook/react"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          <Search size={18} />
          Explore
        </button>
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? <div className="loader" style={{width: 18, height: 18, borderWidth: 2}}></div> : <Download size={18} />}
          Download
        </button>
      </form>

      {activeRepo && branches.length > 0 && (
        <div className="branch-selector" style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem'}}>
          <GitBranch size={16} color="var(--primary)" />
          <span style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Branch:</span>
          <select 
            value={activeBranch} 
            onChange={(e) => setActiveBranch(e.target.value)}
            style={{
              background: '#1A1B23', // Strict dark background color for drop down menu
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text)',
              padding: '0.4rem 0.8rem',
              borderRadius: '0.3rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="" style={{background: '#1A1B23', color: '#fff'}}>Default Branch</option>
            {branches.map(b => <option key={b} value={b} style={{background: '#1A1B23', color: '#fff'}}>{b}</option>)}
          </select>
          {isLoadingBranches && <div className="loader" style={{width: 14, height: 14, borderWidth: 2}}></div>}
        </div>
      )}

      {activeRepo && (
        <>
          <div className="tab-container">
            <button 
              className={`tab-btn ${activeTab === 'commits' ? 'active' : ''}`}
              onClick={() => setActiveTab('commits')}
            >
              Commits Explorer
            </button>
            <button 
              className={`tab-btn ${activeTab === 'changelog' ? 'active' : ''}`}
              onClick={() => setActiveTab('changelog')}
            >
              Changelog Generator
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            {activeTab === 'commits' ? (
              <CommitTable repo={activeRepo} branch={activeBranch} />
            ) : (
              <ChangelogGenerator repo={activeRepo} branch={activeBranch} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
