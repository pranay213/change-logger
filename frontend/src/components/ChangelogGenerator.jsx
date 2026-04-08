import { useState, useEffect } from 'react';
import { fetchChangelog } from '../services/api';
import { Copy, Check } from 'lucide-react';

const ChangelogGenerator = ({ repo, branch, githubToken }) => {
  const [changelogStr, setChangelogStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadChangelog();
  }, [repo, branch, githubToken]);

  const loadChangelog = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchChangelog(repo, branch, githubToken);
      
      // Generate the TS array format utilizing the data from backend
      const tsCode = `const versionsFrontend: ChangelogVersionType[] = [\n${data.map(v => `  {
    title: '${v.title}',
    createdAt: appDayJs.utc('${v.createdAt}'),
    added: ${JSON.stringify(v.added, null, 2).replace(/\n/g, '\n    ').trim()},
    changed: ${JSON.stringify(v.changed, null, 2).replace(/\n/g, '\n    ').trim()},
    fixed: ${JSON.stringify(v.fixed, null, 2).replace(/\n/g, '\n    ').trim()},
    authors: ${JSON.stringify(v.authors)},
  },`).join('\n')}\n];\n\nexport default versionsFrontend;`;
      
      setChangelogStr(tsCode);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate changelog');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(changelogStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0' }}>
        <div className="loader"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
          Analyzing tags and commits... This might take a moment.
        </p>
      </div>
    );
  }

  if (error) {
    return <div className="error-msg">{error}</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Generated TS Export</h3>
        <button className="btn btn-secondary" onClick={handleCopy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
      </div>
      
      <pre className="code-block">
        <code>{changelogStr}</code>
      </pre>
    </div>
  );
};

export default ChangelogGenerator;
