declare module 'expo-secure-store' {
  export function __resetStore(): void;

  export function getItemAsync(AUTH_TOKEN: string): string | PromiseLike<string | null> | null {
    throw new Error('Function not implemented.');
  }

  export function setItemAsync(AUTH_TOKEN: string, token: string) {
    throw new Error('Function not implemented.');
  }

  export function deleteItemAsync(AUTH_TOKEN: string) {
    throw new Error('Function not implemented.');
  }
}
