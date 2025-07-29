import axios from 'axios';

const LOCAL_BASE = 'http://192.168.100.73:3000';
const PROD_BASE = 'https://stockx-3vvh.onrender.com';

export const getBaseUrl = async (): Promise<string> => {
  try {
    // Check if local API is alive
    await axios.get(`${LOCAL_BASE}/ping`, { timeout: 2000 });
    return LOCAL_BASE;
  } catch {
    return PROD_BASE;
  }
};