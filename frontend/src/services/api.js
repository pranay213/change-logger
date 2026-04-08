import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const fetchCommits = async (repo, branch = '', page = 1, perPage = 50) => {
  const response = await axios.get(`${API_BASE_URL}/commits`, {
    params: { repo, branch, page, per_page: perPage },
  });
  return response.data;
};

export const fetchChangelog = async (repo, branch = '') => {
  const response = await axios.get(`${API_BASE_URL}/changelog`, {
    params: { repo, branch },
  });
  return response.data.changelog; // The endpoint returns { changelog: [...] }
};

export const fetchBranches = async (repo) => {
  const response = await axios.get(`${API_BASE_URL}/branches`, {
    params: { repo },
  });
  return response.data.branches;
};
