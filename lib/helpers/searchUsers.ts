import api from '../api'; // adjust path if needed

export const searchUsers = async (query: string) => {
  try {
    const response = await api.get('api/v1/users/search', {
      params: { q: query },
      headers: {
        Accept: 'application/json',
      },
    });

    const users = response.data.data.map((user: any) => ({
      id: user.id,
      username: user.attributes.username,
      email: user.attributes.email,
      avatar_url: user.attributes.avatar_url,
    }));

    return users;
  } catch (error) {
    console.error('Failed to search users:', error);
    return [];
  }
};