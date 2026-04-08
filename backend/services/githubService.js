const axios = require('axios');

class GithubService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

  }

  // Helper to add authorization header to config if token is provided
  _getConfig(token) {
    const config = { headers: {} };
    if (token) {
      config.headers.Authorization = `token ${token}`; // GitHub supports 'token <token>' or 'Bearer <token>'
    }
    return config;
  }

  async getCommits(owner, repo, branch, token, page = 1, perPage = 100) {
    const url = `/repos/${owner}/${repo}/commits`;
    const params = { page, per_page: perPage };
    if (branch) params.sha = branch;

    const config = this._getConfig(token);
    config.params = params;

    const response = await this.client.get(url, config);
    
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

  async getTags(owner, repo, token) {
    const url = `/repos/${owner}/${repo}/tags`;
    const config = this._getConfig(token);
    config.params = { per_page: 100 };
    const response = await this.client.get(url, config);
    return response.data; // Array of tags, each has name and commit.sha
  }

  async getBranches(owner, repo, token) {
    const url = `/repos/${owner}/${repo}/branches`;
    const config = this._getConfig(token);
    config.params = { per_page: 100 };
    const response = await this.client.get(url, config);
    return response.data.map(branch => branch.name);
  }

  async getCommit(owner, repo, sha, token) {
    const url = `/repos/${owner}/${repo}/commits/${sha}`;
    const config = this._getConfig(token);
    const response = await this.client.get(url, config);
    return response.data;
  }
}

module.exports = new GithubService();
