const githubService = require('../services/githubService');
const cacheService = require('../services/cacheService');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const fs = require('fs');
const path = require('path');
dayjs.extend(utc);

// Helper to parse commit messages based on conventional commits
function categorizeCommit(message) {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.startsWith('feat') || lowerMsg.startsWith('add') || lowerMsg.startsWith('merge')) return 'added';
  if (lowerMsg.startsWith('fix') || lowerMsg.startsWith('bug')) return 'fixed';
  return 'changed'; // fallback for chore, refactor, style, docs, etc.
}

exports.getCommits = async (req, res) => {
  let { repo, branch, page = 1, per_page = 50, limit } = req.query;
  page = parseInt(page, 10);
  per_page = parseInt(per_page, 10);

  if (repo) {
    repo = repo.replace(/^https?:\/\/github\.com\//, '');
    if (repo.endsWith('/')) repo = repo.slice(0, -1);
  }

  if (!repo || !repo.includes('/')) {
    return res.status(400).json({ error: 'Invalid repository format. Use owner/repo' });
  }

  const [owner, name] = repo.split('/');
  
  if (limit) {
    limit = parseInt(limit, 10);
    // If limit is provided, fetch multiple pages up to limit
    const cacheKey = `commits_${owner}_${name}_${branch || 'default'}_all_limit_${limit}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return res.json(cached);

    try {
      let results = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore && results.length < limit) {
        let chunkLimit = Math.min(100, limit - results.length);
        const { commits, hasNextPage } = await githubService.getCommits(owner, name, branch, currentPage, chunkLimit);
        results = results.concat(commits);
        hasMore = hasNextPage;
        currentPage++;
      }

      const responseData = { commits: results, hasNextPage: hasMore };
      cacheService.set(cacheKey, responseData, 600);
      return res.json(responseData);

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Standard pagination
  const cacheKey = `commits_${owner}_${name}_${branch || 'default'}_page_${page}_per_${per_page}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await githubService.getCommits(owner, name, branch, page, per_page);
    cacheService.set(cacheKey, data, 300); // cache page for 5 mins
    return res.json(data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    return res.status(500).json({ error: error.message });
  }
};

exports.getChangelog = async (req, res) => {
  let { repo, branch } = req.query;

  if (repo) {
    repo = repo.replace(/^https?:\/\/github\.com\//, '');
    if (repo.endsWith('/')) repo = repo.slice(0, -1);
  }

  if (!repo || !repo.includes('/')) {
    return res.status(400).json({ error: 'Invalid repository format. Use owner/repo' });
  }
  const [owner, name] = repo.split('/');

  const cacheKey = `changelog_${owner}_${name}_${branch || 'default'}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return res.json({ changelog: cached, fileWritten: true, path: '/public/versionsFrontend.ts' });

  try {
    // 1. Fetch latest commits up to 500
    let allCommits = [];
    let page = 1;
    let hasMore = true;
    while (allCommits.length < 500 && hasMore) {
      const { commits, hasNextPage } = await githubService.getCommits(owner, name, branch, page, 100);
      allCommits = allCommits.concat(commits);
      hasMore = hasNextPage;
      page++;
    }

    if (allCommits.length === 0) {
      return res.status(404).json({ error: 'No commits found in this repository.' });
    }

    // 2. Group commits by 'Merge pull request' boundaries instead of tags
    const changelogTypes = [];
    let mergeCount = allCommits.filter(c => c.message.toLowerCase().startsWith('merge pull request') || c.message.toLowerCase().startsWith('merge branch')).length;
    let versionCounter = mergeCount > 0 ? mergeCount + 1 : 1;

    // Setup initial bucket for the latest commits before any merge
    changelogTypes.push({
      title: `1.1.${versionCounter}`,
      createdAt: allCommits[0].date,
      added: [],
      changed: [],
      fixed: [],
      authors: new Set()
    });

    for (const commit of allCommits) {
      const Bucket = changelogTypes[changelogTypes.length - 1];
      const firstLine = commit.message.split('\n')[0];
      const lowerMsg = firstLine.toLowerCase();
      
      const isMerge = lowerMsg.startsWith('merge pull request') || lowerMsg.startsWith('merge branch');

      if (isMerge) {
        // Use the merge commit as a version boundary, but do NOT push its "Merge pull request..." message into any log array.
        Bucket.authors.add(commit.author);
        Bucket.createdAt = commit.date;

        // Since we hit a merge boundary, prepare a new bucket for older commits
        versionCounter--;
        changelogTypes.push({
          title: `1.1.${Math.max(versionCounter, 0)}`,
          createdAt: commit.date, // Default to this merge date, may be overwritten by the next merge
          added: [],
          changed: [],
          fixed: [],
          authors: new Set()
        });
      } else {
        const category = categorizeCommit(firstLine);
        Bucket[category].push(firstLine.substring(0, 150));
        Bucket.authors.add(commit.author);
      }
    }

    // Filter out completely empty buckets at the very end (if any)
    const validBuckets = changelogTypes.filter(b => 
      b.added.length > 0 || b.changed.length > 0 || b.fixed.length > 0
    );

    // Post-process to ensure createdAt is filled using dayjs
    const formattedChangelog = validBuckets.map(v => ({
      title: v.title,
      // Fallback date if not matched
      createdAt: v.createdAt ? dayjs(v.createdAt).utc().format() : dayjs().utc().format(),
      added: v.added,
      changed: v.changed,
      fixed: v.fixed,
      authors: Array.from(v.authors)
    }));

    // Generate TS format and save it physically to backend/public/versionsFrontend.ts
    const tsCode = `const versionsFrontend: ChangelogVersionType[] = [\n${formattedChangelog.map(v => `  {
    title: '${v.title}',
    createdAt: appDayJs.utc('${v.createdAt}'),
    added: ${JSON.stringify(v.added, null, 2).replace(/\n/g, '\n    ').trim()},
    changed: ${JSON.stringify(v.changed, null, 2).replace(/\n/g, '\n    ').trim()},
    fixed: ${JSON.stringify(v.fixed, null, 2).replace(/\n/g, '\n    ').trim()},
    authors: ${JSON.stringify(v.authors)}
  },`).join('\n')}\n];\n\nexport default versionsFrontend;`;

    const publicPath = path.join(__dirname, '../public');
    const filePath = path.join(publicPath, 'versionsFrontend.ts');
    fs.writeFileSync(filePath, tsCode, 'utf8');

    cacheService.set(cacheKey, formattedChangelog, 3600); // 1 hr cache
    return res.json({ changelog: formattedChangelog, fileWritten: true, path: '/public/versionsFrontend.ts' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

exports.createChangelogFile = (req, res) => {
  try {
    const { changelog } = req.body;
    
    if (!changelog || !Array.isArray(changelog)) {
      return res.status(400).json({ error: 'Valid json body with "changelog" array is required.' });
    }

    const tsCode = `const versionsFrontend: ChangelogVersionType[] = [\n${changelog.map(v => `  {
    title: '${v.title}',
    createdAt: appDayJs.utc('${v.createdAt}'),
    added: ${JSON.stringify(v.added || [], null, 2).replace(/\n/g, '\n    ').trim()},
    changed: ${JSON.stringify(v.changed || [], null, 2).replace(/\n/g, '\n    ').trim()},
    fixed: ${JSON.stringify(v.fixed || [], null, 2).replace(/\n/g, '\n    ').trim()},
    authors: ${JSON.stringify(v.authors || [])}
  },`).join('\n')}\n];\n\nexport default versionsFrontend;`;

    const publicPath = path.join(__dirname, '../public');
    const filePath = path.join(publicPath, 'versionsFrontend.ts');
    
    // Ensure public folder exists
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }
    
    fs.writeFileSync(filePath, tsCode, 'utf8');

    return res.json({ 
      success: true, 
      message: 'File successfully created!', 
      path: '/public/versionsFrontend.ts' 
    });
  } catch (error) {
    console.error('Error creating changelog file:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getBranches = async (req, res) => {
  let { repo } = req.query;
  
  if (repo) {
    repo = repo.replace(/^https?:\/\/github\.com\//, '');
    if (repo.endsWith('/')) repo = repo.slice(0, -1);
  }

  if (!repo || !repo.includes('/')) {
    return res.status(400).json({ error: 'Invalid repository format' });
  }
  const [owner, name] = repo.split('/');

  const cacheKey = `branches_${owner}_${name}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return res.json({ branches: cached });

  try {
    const branches = await githubService.getBranches(owner, name);
    cacheService.set(cacheKey, branches, 300);
    return res.json({ branches });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    return res.status(500).json({ error: error.message });
  }
};
