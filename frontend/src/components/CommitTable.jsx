import { useState, useEffect } from 'react';
import { fetchCommits } from '../services/api';
import dayjs from 'dayjs';
import { ExternalLink } from 'lucide-react';

const CommitTable = ({ repo, branch, githubToken }) => {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    // Reset state on new repo or branch
    setCommits([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    loadCommits(1, true);
  }, [repo, branch, githubToken]);

  const loadCommits = async (currentPage, isReset = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCommits(repo, branch, githubToken, currentPage);
      
      setCommits(prev => isReset ? data.commits : [...prev, ...data.commits]);
      setHasMore(data.hasNextPage);
      
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch commits');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadCommits(nextPage);
  };

  if (error && commits.length === 0) {
    return <div className="error-msg">{error}</div>;
  }

  return (
    <>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Author</th>
              <th>Commit Message</th>
              <th>Date</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {commits.map((commit, index) => (
              <tr key={`${commit.sha}-${index}`}>
                <td>
                  <div className="commit-author">
                    <div className="author-avatar">
                      {commit.author.charAt(0).toUpperCase()}
                    </div>
                    {commit.author}
                  </div>
                </td>
                <td>
                  <span className="commit-msg" title={commit.message}>
                    {commit.message.split('\n')[0]}
                  </span>
                </td>
                <td className="commit-date">
                  {dayjs(commit.date).format('MMM D, YYYY h:mm A')}
                </td>
                <td>
                  <a 
                    href={commit.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="commit-hash"
                  >
                    {commit.sha.substring(0, 7)}
                    <ExternalLink size={12} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="load-more-container">
          <div className="loader"></div>
        </div>
      )}

      {!loading && hasMore && (
        <div className="load-more-container">
          <button className="btn btn-secondary" onClick={handleLoadMore}>
            Load More
          </button>
        </div>
      )}
      
      {!hasMore && commits.length > 0 && (
        <div className="load-more-container" style={{ color: 'var(--text-muted)' }}>
          All commits loaded.
        </div>
      )}
    </>
  );
};

export default CommitTable;
