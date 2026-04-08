const axios = require('axios');

class GithubService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    // Request interceptor to add token if available
    this.client.interceptors.request.use((config) => {
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor to handle rate limiting
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (
          error.response &&
          error.response.status === 403 &&
          error.response.headers['x-ratelimit-remaining'] === '0'
        ) {
          const resetTime = error.response.headers['x-ratelimit-reset'];
          const delay = resetTime ? resetTime * 1000 - Date.now() : 60000;
          console.warn(`Rate limit hit. Retrying after ${delay}ms...`);
          // Note: In a real app we might not want to block the thread this long or we let the client handle it.
          // For now, we will reject and pass a meaningful message to the user instead of hanging the server.
          return Promise.reject(new Error(`GitHub API rate limit exceeded. Resets in ${Math.round(delay/1000)}s`));
        }
        return Promise.reject(error);
      }
    );
  }

  async getCommits(owner, repo, branch, page = 1, perPage = 100) {
    const url = `/repos/${owner}/${repo}/commits`;
    const params = { page, per_page: perPage };
    if (branch) params.sha = branch;

    const response = await this.client.get(url, { params });
    
    // Parse response headers to see if there's a next page
    const linkHeader = response.headers.link;
    const hasNextPage = linkHeader && linkHeader.includes('rel="next"');

    // Return the formatted commits
    const commits = response.data.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url
    }));

    return { commits, hasNextPage };
  }

  async getTags(owner, repo) {
    const url = `/repos/${owner}/${repo}/tags`;
    const response = await this.client.get(url, { params: { per_page: 100 } });
    return response.data; // Array of tags, each has name and commit.sha
  }

  async getBranches(owner, repo) {
    const url = `/repos/${owner}/${repo}/branches`;
    const response = await this.client.get(url, { params: { per_page: 100 } });
    return response.data.map(branch => branch.name);
  }

  async getCommit(owner, repo, sha) {
    const url = `/repos/${owner}/${repo}/commits/${sha}`;
    const response = await this.client.get(url);
    return response.data;
  }
}

module.exports = new GithubService();
