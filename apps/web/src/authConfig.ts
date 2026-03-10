export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '501578b4-7fa4-480f-ba07-474a18db7cef',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || '6701f6a4-b306-4be9-93be-7b9809225222'}`,
    redirectUri:
      import.meta.env.VITE_AZURE_REDIRECT_URI ||
      (typeof window !== 'undefined' ? window.location.origin : undefined),
  },
};

export const loginRequest = {
  scopes: ['User.Read'],
};
