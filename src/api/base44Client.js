// Mock Base44 client for local development
export const base44 = {
  auth: {
    me: () => Promise.resolve({ id: 'mock-user', name: 'Local User' }),
    logout: () => {},
    redirectToLogin: () => {},
  },
  // Add other mock methods as needed for pages
};

