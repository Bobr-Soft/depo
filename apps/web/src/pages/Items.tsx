import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Item {
  id: number;
  name: string;
  description: string;
  quantity: number;
  location: string;
}

interface ItemsProps {
  onLogout: () => void;
}

export const Items = ({ onLogout }: ItemsProps) => {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        console.log('🔄 Fetching items from API...');
        const res = await api.get('/items');
        console.log('✅ API Response: Adatok betöltve' );
        setItems(res.data);
        setError(null);
      } catch (err: unknown) {
        const error = err as { response?: { status: number; data?: { message: string } }; message: string };
        console.error('❌ Error fetching items:', error);
        console.error('Error response:', error.response);

        if (error.response?.status === 401 || error.response?.status === 403) {
          setError('Your session has expired or you no longer have access. Please log in again.');
          // Auto logout on auth error
          setTimeout(() => onLogout(), 3000);
        } else {
          setError(error.response?.data?.message || error.message || 'Failed to load items');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [onLogout]);

  if (error) return (
    <div>
      <h2>Access Error</h2>
      <p style={{ color: 'red' }}>{error}</p>
      <button onClick={onLogout}>
        Logout & Return to Login
      </button>
    </div>
  );

  return (
    <div>
      <div>
        <h1>Inventory Management</h1>
        <p>{loading ? 'Loading...' : `${items.length} items in inventory`}</p>
        <button onClick={onLogout}>
          Logout
        </button>
      </div>

      <div>
        <table style={{ border: '1px solid black', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Loading...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div>
                    <h3>No items found</h3>
                    <p>Start by adding some items to your inventory</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{item.location}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
