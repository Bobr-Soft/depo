import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AlertTriangle,
  CheckCircle,
  Edit2,
  Minus,
  Package,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { api } from '../services/api';

type Priority = 'normal' | 'urgent';
type RequestStatus = 'pending' | 'picking' | 'transit' | 'delivered';
type RoleMode = 'OPERATOR' | 'ADMIN';

type CatalogItem = {
  id: number;
  name: string;
  code: string;
  barcode: string;
  category: string;
  stock: number;
  location?: string;
};

type ActiveRequest = {
  id: string;
  line: string;
  status: RequestStatus;
  totalItems: number;
  createdAt: string | Date;
  priority: Priority;
};

type AdminRequest = {
  id: string;
  taskId: number;
  name: string;
  line: string;
  status: RequestStatus;
  priority: Priority;
  totalItems: number;
  pickedItems: number;
  assignedUserId: number | null;
  assignedUserEmail: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ApiItem = {
  id: number;
  name: string;
  barcode?: string | null;
  description?: string | null;
  quantity?: number;
  category?: string | null;
};

type MaterialRequestDetail = {
  id: string;
  taskId: number;
  line: string;
  status: RequestStatus;
  priority: Priority;
  assignedUserId: number | null;
  warning?: string | null;
  items: Array<{
    itemId: number;
    requestedQuantity: number;
    name: string;
  }>;
};

type UserOption = {
  id: number;
  email: string;
};

type CatalogForm = {
  id: number | null;
  name: string;
  code: string;
  location: string;
  stock: string;
};

const statusMeta: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#f59e0b' },
  picking: { label: 'In Progress', color: '#3b82f6' },
  transit: { label: 'In Progress', color: '#3b82f6' },
  delivered: { label: 'Delivered', color: '#22c55e' },
};

const statusCycle: RequestStatus[] = ['pending', 'picking', 'delivered'];

const panelSx = {
  bgcolor: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 2,
};

const resolvePickingErrorMessage = (status?: number, fallback = 'Unexpected backend error.') => {
  if (status === undefined) {
    return 'API server is unreachable. Check backend and VITE_API_URL.';
  }
  if (status === 401 || status === 403) {
    return 'Session expired or permission denied. Please sign in again.';
  }
  if (status === 503) {
    return 'Database is temporarily unavailable. Try again shortly.';
  }
  return fallback;
};

const normalizeRole = (role?: string): RoleMode => {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'admin' ? 'ADMIN' : 'OPERATOR';
};

const mapStatus = (status: string): RequestStatus => {
  const raw = String(status || '').toLowerCase();
  if (raw === 'delivered') {
    return 'delivered';
  }
  if (raw === 'picking' || raw === 'transit') {
    return 'picking';
  }
  return 'pending';
};

interface PickingPageProps {
  userRole?: string;
}

export default function PickingPage({ userRole }: PickingPageProps) {
  const theme = useTheme();
  const [line, setLine] = useState('SMT-01');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priority, setPriority] = useState<Priority>('normal');
  const [roleMode, setRoleMode] = useState<RoleMode>(normalizeRole(userRole));

  const [cart, setCart] = useState<Record<number, number>>({});
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [operatorRequests, setOperatorRequests] = useState<ActiveRequest[]>([]);
  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([]);
  const [metrics, setMetrics] = useState({ activeRequests: 0, urgentRequests: 0, totalRequests: 0 });
  const [users, setUsers] = useState<UserOption[]>([]);

  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isRequestsLoading, setIsRequestsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);
  const [deleteCatalogId, setDeleteCatalogId] = useState<number | null>(null);
  const [assignRequestId, setAssignRequestId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>('');

  const [editRequest, setEditRequest] = useState<MaterialRequestDetail | null>(null);
  const [editWarning, setEditWarning] = useState<string | null>(null);

  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [catalogForm, setCatalogForm] = useState<CatalogForm>({
    id: null,
    name: '',
    code: '',
    location: '',
    stock: '0',
  });

  useEffect(() => {
    setRoleMode(normalizeRole(userRole));
  }, [userRole]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(catalog.map((item) => item.category).filter(Boolean)));
    return ['All', ...unique];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      const categoryMatch = selectedCategory === 'All' || item.category === selectedCategory;
      const searchMatch =
        q.length === 0 ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q);
      return categoryMatch && searchMatch;
    });
  }, [catalog, search, selectedCategory]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => {
        const item = catalog.find((catalogItem) => catalogItem.id === Number(id));
        if (!item) {
          return null;
        }
        return { item, quantity };
      })
      .filter((value): value is { item: CatalogItem; quantity: number } => Boolean(value));
  }, [cart, catalog]);

  const fetchCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    try {
      const response = await api.get('/items');
      const mapped = (Array.isArray(response.data) ? response.data : []).map((item: ApiItem) => ({
        id: item.id,
        name: item.name,
        code: item.barcode || `ITEM-${item.id}`,
        barcode: item.barcode || '',
        category: item.category || 'Uncategorized',
        stock: Math.max(0, Number(item.quantity || 0)),
        location: item.description || '',
      }));
      setCatalog(mapped);
      setErrorMessage(null);
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Failed to load item catalog.'));
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  const fetchOperatorRequests = useCallback(async () => {
    setIsRequestsLoading(true);
    try {
      const response = await api.get('/material-requests', { params: { line } });
      const data = Array.isArray(response.data) ? response.data : [];
      setOperatorRequests(
        data.map((request) => ({
          ...request,
          status: mapStatus(request.status),
        }))
      );
      setErrorMessage(null);
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Failed to load line requests.'));
    } finally {
      setIsRequestsLoading(false);
    }
  }, [line]);

  const fetchAdminRequests = useCallback(async () => {
    setIsRequestsLoading(true);
    try {
      const [requestsResponse, metricsResponse, usersResponse] = await Promise.all([
        api.get('/material-requests/all'),
        api.get('/material-requests/metrics'),
        api.get('/users'),
      ]);
      const requestData = Array.isArray(requestsResponse.data) ? requestsResponse.data : [];
      setAdminRequests(
        requestData.map((request) => ({
          ...request,
          status: mapStatus(request.status),
        }))
      );
      setMetrics({
        activeRequests: Number(metricsResponse.data?.activeRequests || 0),
        urgentRequests: Number(metricsResponse.data?.urgentRequests || 0),
        totalRequests: Number(metricsResponse.data?.totalRequests || 0),
      });
      const userData = Array.isArray(usersResponse.data) ? usersResponse.data : [];
      setUsers(
        userData.map((item) => ({
          id: item.id,
          email: item.email,
        }))
      );
      setErrorMessage(null);
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Failed to load admin request data.'));
    } finally {
      setIsRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    if (roleMode === 'ADMIN') {
      fetchAdminRequests();
      return;
    }
    fetchOperatorRequests();
  }, [roleMode, fetchAdminRequests, fetchOperatorRequests]);

  const refreshRequests = async () => {
    if (roleMode === 'ADMIN') {
      await fetchAdminRequests();
      return;
    }
    await fetchOperatorRequests();
  };

  const setQuantity = (itemId: number, quantity: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[itemId];
        return next;
      }
      next[itemId] = quantity;
      return next;
    });
  };

  const handleSubmitRequest = async () => {
    if (cartItems.length === 0) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/material-requests', {
        line,
        priority,
        items: cartItems.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
      });
      setCart({});
      setPriority('normal');
      await refreshRequests();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Request submission failed.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOperatorRequest = async (requestId: string) => {
    try {
      await api.post(`/material-requests/${requestId}/cancel`);
      await fetchOperatorRequests();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Request cancel failed.'));
    }
  };

  const cycleStatus = async (request: AdminRequest) => {
    const currentIndex = statusCycle.indexOf(request.status);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    try {
      await api.put(`/material-requests/${request.id}/status`, { status: nextStatus });
      await fetchAdminRequests();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Status update failed.'));
    }
  };

  const openAssignDialog = (request: AdminRequest) => {
    setAssignRequestId(request.id);
    setAssignUserId(request.assignedUserId ? String(request.assignedUserId) : '');
  };

  const submitAssign = async () => {
    if (!assignRequestId) {
      return;
    }
    try {
      await api.put(`/material-requests/${assignRequestId}/assign`, {
        assignedUserId: assignUserId ? Number(assignUserId) : null,
      });
      setAssignRequestId(null);
      await fetchAdminRequests();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Assignment failed.'));
    }
  };

  const openEditRequest = async (requestId: string) => {
    try {
      const response = await api.get(`/material-requests/${requestId}`);
      setEditRequest(response.data);
      setEditWarning(null);
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Loading request detail failed.'));
    }
  };

  const updateEditItemQuantity = (itemId: number, quantity: number) => {
    setEditRequest((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.itemId === itemId ? { ...item, requestedQuantity: Math.max(1, quantity) } : item
        ),
      };
    });
  };

  const submitEditRequest = async () => {
    if (!editRequest) {
      return;
    }
    try {
      const response = await api.put(`/material-requests/${editRequest.id}`, {
        line: editRequest.line,
        priority: editRequest.priority,
        items: editRequest.items.map((item) => ({ itemId: item.itemId, quantity: item.requestedQuantity })),
      });
      setEditWarning(response.data?.warning || null);
      await fetchAdminRequests();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Request edit failed.'));
    }
  };

  const submitDeleteRequest = async () => {
    if (!deleteRequestId) {
      return;
    }
    try {
      await api.delete(`/material-requests/${deleteRequestId}`);
      setDeleteRequestId(null);
      await fetchAdminRequests();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Delete request failed.'));
    }
  };

  const openAddCatalogModal = () => {
    setCatalogForm({ id: null, name: '', code: '', location: '', stock: '0' });
    setCatalogFormOpen(true);
  };

  const openEditCatalogModal = (item: CatalogItem) => {
    setCatalogForm({
      id: item.id,
      name: item.name,
      code: item.barcode || item.code,
      location: item.location || '',
      stock: String(item.stock),
    });
    setCatalogFormOpen(true);
  };

  const submitCatalogForm = async () => {
    const payload = {
      name: catalogForm.name,
      barcode: catalogForm.code,
      description: catalogForm.location,
      quantity: Number(catalogForm.stock || 0),
    };
    try {
      if (catalogForm.id) {
        await api.put(`/items/${catalogForm.id}`, payload);
      } else {
        await api.post('/items', payload);
      }
      setCatalogFormOpen(false);
      await fetchCatalog();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Catalog save failed.'));
    }
  };

  const submitDeleteCatalog = async () => {
    if (!deleteCatalogId) {
      return;
    }
    try {
      await api.delete(`/items/${deleteCatalogId}`);
      setDeleteCatalogId(null);
      await fetchCatalog();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setErrorMessage(resolvePickingErrorMessage(status, 'Catalog delete failed.'));
    }
  };

  const renderOperatorView = () => (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', xl: '1.25fr 1fr 0.95fr' },
      }}
    >
      <Paper sx={{ ...panelSx, p: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1.5} color="white">
          Catalog
        </Typography>

        <TextField
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search code, name, barcode..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={20} color="#94a3b8" />
              </InputAdornment>
            ),
            sx: { color: 'white' },
          }}
          sx={{ mb: 1.5 }}
        />

        <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
          {categories.map((category) => (
            <Chip
              key={category}
              label={category}
              onClick={() => setSelectedCategory(category)}
              variant={selectedCategory === category ? 'filled' : 'outlined'}
              sx={{
                minHeight: 38,
                color: selectedCategory === category ? '#fff' : '#cbd5e1',
                bgcolor: selectedCategory === category ? '#f97316' : 'transparent',
                borderColor: '#334155',
              }}
            />
          ))}
        </Stack>

        <Stack spacing={1.25} sx={{ maxHeight: '62vh', overflowY: 'auto', pr: 0.5 }}>
          {isCatalogLoading && (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}

          {!isCatalogLoading && filteredCatalog.map((item) => {
            const quantity = cart[item.id] ?? 0;
            return (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: '#334155', bgcolor: '#020617' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Package size={18} color="#94a3b8" />
                      <Typography fontWeight={700} color="white">{item.name}</Typography>
                    </Stack>
                    <Typography variant="body2" color="#cbd5e1">{item.code}</Typography>
                    <Typography variant="body2" sx={{ color: '#22c55e', fontWeight: 700 }}>
                      Available: {item.stock}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <IconButton
                      onClick={() => setQuantity(item.id, Math.max(0, quantity - 1))}
                      sx={{ width: 42, height: 42, border: '1px solid #334155', bgcolor: '#0f172a' }}
                    >
                      <Minus size={16} color={theme.palette.text.primary} />
                    </IconButton>
                    <Typography sx={{ minWidth: 24, textAlign: 'center', fontWeight: 800, color: 'white' }}>
                      {quantity}
                    </Typography>
                    <IconButton
                      onClick={() => setQuantity(item.id, quantity + 1)}
                      sx={{ width: 42, height: 42, border: '1px solid #334155', bgcolor: '#0f172a' }}
                    >
                      <Plus size={16} color={theme.palette.text.primary} />
                    </IconButton>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Paper>

      <Paper sx={{ ...panelSx, p: 2, display: 'flex', flexDirection: 'column', minHeight: { xl: '72vh' } }}>
        <Typography variant="h6" fontWeight={700} mb={1.5} color="white">
          Request Builder
        </Typography>

        <Stack spacing={1} sx={{ flex: 1, maxHeight: '48vh', overflowY: 'auto', pr: 0.5 }}>
          {cartItems.length === 0 && <Typography color="#94a3b8">No items in request.</Typography>}
          {cartItems.map(({ item, quantity }) => (
            <Paper key={item.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2, borderColor: '#334155', bgcolor: '#020617' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Box>
                  <Typography fontWeight={700} color="white">{item.name}</Typography>
                  <Typography variant="body2" color="#cbd5e1">{item.code}</Typography>
                  <Typography variant="h6" fontWeight={800} color="white">{quantity}</Typography>
                  {quantity > item.stock && (
                    <Stack direction="row" spacing={0.5} alignItems="center" mt={0.4}>
                      <AlertTriangle size={15} color="#facc15" />
                      <Typography variant="body2" sx={{ color: '#facc15' }}>Partial fill expected</Typography>
                    </Stack>
                  )}
                </Box>
                <IconButton onClick={() => setQuantity(item.id, 0)} sx={{ border: '1px solid #334155' }}>
                  <Trash2 size={18} color="#ef4444" />
                </IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>

        <Divider sx={{ my: 1.5, borderColor: '#1e293b' }} />

        <Typography variant="subtitle1" fontWeight={700} mb={1} color="white">
          Priority
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={priority}
          onChange={(_, value: Priority | null) => value && setPriority(value)}
          sx={{ mb: 1.5 }}
        >
          <ToggleButton value="normal" sx={{ color: '#cbd5e1' }}>Normal</ToggleButton>
          <ToggleButton value="urgent" sx={{ color: '#ef4444' }}>Urgent / Line Stop</ToggleButton>
        </ToggleButtonGroup>

        <Button
          onClick={handleSubmitRequest}
          disabled={cartItems.length === 0 || isSubmitting}
          variant="contained"
          sx={{
            mt: 'auto',
            minHeight: 60,
            fontSize: 20,
            fontWeight: 800,
            textTransform: 'none',
            bgcolor: '#f97316',
            '&:hover': { bgcolor: '#ea580c' },
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </Button>
      </Paper>

      <Paper sx={{ ...panelSx, p: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1.5} color="white">
          Live Tracking
        </Typography>

        <Stack spacing={1.25} sx={{ maxHeight: '66vh', overflowY: 'auto', pr: 0.5 }}>
          {isRequestsLoading && (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          )}

          {!isRequestsLoading && operatorRequests.map((request) => {
            const meta = statusMeta[request.status];
            return (
              <Paper key={request.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: '#334155', bgcolor: '#020617' }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography fontWeight={800} color="white">{request.id}</Typography>
                    <Typography variant="body2" color="#94a3b8">
                      Line: {request.line} • {request.totalItems} items
                    </Typography>
                    <Stack direction="row" spacing={0.8} alignItems="center" mt={0.8}>
                      {request.status === 'delivered' ? (
                        <CheckCircle size={16} color={meta.color} />
                      ) : (
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: meta.color }} />
                      )}
                      <Typography variant="body2" sx={{ color: meta.color, fontWeight: 700 }}>
                        {meta.label}
                      </Typography>
                    </Stack>
                  </Box>

                  <Stack direction="row" spacing={0.5}>
                    {request.priority === 'urgent' && <Chip label="P1" color="error" variant="outlined" />}
                    {request.status === 'pending' && (
                      <IconButton onClick={() => handleCancelOperatorRequest(request.id)} sx={{ border: '1px solid #7f1d1d' }}>
                        <Trash2 size={16} color="#ef4444" />
                      </IconButton>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Paper>
    </Box>
  );

  const renderAdminView = () => (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <Paper sx={{ ...panelSx, p: 2, minWidth: 190 }}>
          <Typography color="#93c5fd" fontWeight={700}>Active Requests</Typography>
          <Typography variant="h4" color="white" fontWeight={800}>{metrics.activeRequests}</Typography>
        </Paper>
        <Paper sx={{ ...panelSx, p: 2, minWidth: 190 }}>
          <Typography color="#fca5a5" fontWeight={700}>Urgent</Typography>
          <Typography variant="h4" color="white" fontWeight={800}>{metrics.urgentRequests}</Typography>
        </Paper>
        <Paper sx={{ ...panelSx, p: 2, minWidth: 190 }}>
          <Typography color="#34d399" fontWeight={700}>Total Requests</Typography>
          <Typography variant="h4" color="white" fontWeight={800}>{metrics.totalRequests}</Typography>
        </Paper>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 360px' }, gap: 2 }}>
        <Paper sx={{ ...panelSx, p: 2 }}>
          <Typography variant="h6" fontWeight={700} color="white" mb={1.5}>
            Request Management
          </Typography>

          {isRequestsLoading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#93c5fd' }}>Request</TableCell>
                  <TableCell sx={{ color: '#93c5fd' }}>Line</TableCell>
                  <TableCell sx={{ color: '#93c5fd' }}>Status</TableCell>
                  <TableCell sx={{ color: '#93c5fd' }}>Progress</TableCell>
                  <TableCell sx={{ color: '#93c5fd' }}>Assigned</TableCell>
                  <TableCell sx={{ color: '#93c5fd' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adminRequests.map((request) => (
                  <TableRow key={request.id} hover>
                    <TableCell sx={{ color: '#e2e8f0' }}>{request.id}</TableCell>
                    <TableCell sx={{ color: '#e2e8f0' }}>{request.line}</TableCell>
                    <TableCell>
                      <Chip
                        label={statusMeta[request.status].label}
                        onClick={() => cycleStatus(request)}
                        variant="outlined"
                        sx={{ borderColor: statusMeta[request.status].color, color: statusMeta[request.status].color }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#cbd5e1' }}>{request.pickedItems}/{request.totalItems}</TableCell>
                    <TableCell sx={{ color: '#cbd5e1' }}>{request.assignedUserEmail || 'Unassigned'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton onClick={() => openEditRequest(request.id)} size="small" sx={{ border: '1px solid #334155' }}>
                          <Edit2 size={14} color="#60a5fa" />
                        </IconButton>
                        <IconButton onClick={() => openAssignDialog(request)} size="small" sx={{ border: '1px solid #334155' }}>
                          <UserPlus size={14} color="#60a5fa" />
                        </IconButton>
                        <IconButton onClick={() => setDeleteRequestId(request.id)} size="small" sx={{ border: '1px solid #7f1d1d' }}>
                          <Trash2 size={14} color="#ef4444" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>

        <Paper sx={{ ...panelSx, p: 2, position: 'relative' }}>
          <Typography variant="h6" color="white" fontWeight={700} mb={1.5}>
            Catalog Management
          </Typography>

          <Stack spacing={1} sx={{ maxHeight: '67vh', overflowY: 'auto' }}>
            {catalog.map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.25, borderColor: '#334155', bgcolor: '#020617' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography color="white" fontWeight={700}>{item.name}</Typography>
                    <Typography variant="body2" color="#94a3b8">{item.code} • Stock: {item.stock}</Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton onClick={() => openEditCatalogModal(item)} size="small" sx={{ border: '1px solid #334155' }}>
                      <Edit2 size={14} color="#60a5fa" />
                    </IconButton>
                    <IconButton onClick={() => setDeleteCatalogId(item.id)} size="small" sx={{ border: '1px solid #7f1d1d' }}>
                      <Trash2 size={14} color="#ef4444" />
                    </IconButton>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Fab
            color="warning"
            onClick={openAddCatalogModal}
            sx={{ position: 'absolute', right: 16, bottom: 16, bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}
          >
            <Plus size={20} />
          </Fab>
        </Paper>
      </Box>
    </Stack>
  );

  return (
    <Container maxWidth="xl" sx={{ bgcolor: '#020617', minHeight: '100vh', py: 3 }}>
      <Stack spacing={2}>
        <Paper sx={{ ...panelSx, p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 210 }}>
              <InputLabel sx={{ color: '#94a3b8' }}>Line</InputLabel>
              <Select
                label="Line"
                value={line}
                onChange={(event) => setLine(event.target.value)}
                sx={{ color: '#fff' }}
              >
                <MenuItem value="SMT-01">SMT-01</MenuItem>
                <MenuItem value="Assembly-B">Assembly-B</MenuItem>
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1} alignItems="center">
              <Shield size={18} color={roleMode === 'ADMIN' ? '#60a5fa' : '#94a3b8'} />
              <ToggleButtonGroup
                exclusive
                size="small"
                value={roleMode}
                onChange={(_, value: RoleMode | null) => value && setRoleMode(value)}
              >
                <ToggleButton value="OPERATOR" sx={{ color: '#e2e8f0' }}>OPERATOR</ToggleButton>
                <ToggleButton value="ADMIN" sx={{ color: '#93c5fd' }}>ADMIN</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <Typography variant="h6" fontWeight={800} color="white" sx={{ ml: { md: 'auto' } }}>
              DEPO Material Request Dashboard
            </Typography>
          </Stack>
        </Paper>

        {errorMessage && (
          <Alert severity="warning" sx={{ border: '1px solid #7c2d12', bgcolor: '#451a03', color: '#fdba74' }}>
            {errorMessage}
          </Alert>
        )}

        {editWarning && roleMode === 'ADMIN' && (
          <Alert severity="warning" sx={{ border: '1px solid #854d0e', bgcolor: '#422006', color: '#fde68a' }}>
            {editWarning}
          </Alert>
        )}

        {roleMode === 'ADMIN' ? renderAdminView() : renderOperatorView()}
      </Stack>

      <Dialog open={Boolean(assignRequestId)} onClose={() => setAssignRequestId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Request</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>User</InputLabel>
            <Select value={assignUserId} label="User" onChange={(event) => setAssignUserId(event.target.value)}>
              <MenuItem value="">Unassigned</MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={String(user.id)}>{user.email}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignRequestId(null)}>Close</Button>
          <Button onClick={submitAssign} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editRequest)} onClose={() => setEditRequest(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Request</DialogTitle>
        <DialogContent>
          {editRequest && (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <TextField
                label="Line"
                value={editRequest.line}
                onChange={(event) => setEditRequest((prev) => (prev ? { ...prev, line: event.target.value } : prev))}
              />
              <ToggleButtonGroup
                exclusive
                value={editRequest.priority}
                onChange={(_, value: Priority | null) =>
                  value && setEditRequest((prev) => (prev ? { ...prev, priority: value } : prev))
                }
              >
                <ToggleButton value="normal">Normal</ToggleButton>
                <ToggleButton value="urgent">Urgent</ToggleButton>
              </ToggleButtonGroup>
              {editRequest.items.map((item) => (
                <Stack key={item.itemId} direction="row" alignItems="center" justifyContent="space-between">
                  <Typography>{item.name}</Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <IconButton size="small" onClick={() => updateEditItemQuantity(item.itemId, item.requestedQuantity - 1)}>
                      <Minus size={14} />
                    </IconButton>
                    <Typography sx={{ minWidth: 24, textAlign: 'center' }}>{item.requestedQuantity}</Typography>
                    <IconButton size="small" onClick={() => updateEditItemQuantity(item.itemId, item.requestedQuantity + 1)}>
                      <Plus size={14} />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRequest(null)}>Close</Button>
          <Button variant="contained" onClick={submitEditRequest}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={catalogFormOpen} onClose={() => setCatalogFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{catalogForm.id ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField label="Name" value={catalogForm.name} onChange={(event) => setCatalogForm((prev) => ({ ...prev, name: event.target.value }))} />
            <TextField label="Code" value={catalogForm.code} onChange={(event) => setCatalogForm((prev) => ({ ...prev, code: event.target.value }))} />
            <TextField label="Location" value={catalogForm.location} onChange={(event) => setCatalogForm((prev) => ({ ...prev, location: event.target.value }))} />
            <TextField label="Initial Stock" type="number" value={catalogForm.stock} onChange={(event) => setCatalogForm((prev) => ({ ...prev, stock: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatalogFormOpen(false)}>Close</Button>
          <Button variant="contained" onClick={submitCatalogForm}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteRequestId)} onClose={() => setDeleteRequestId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#b91c1c' }}>Delete Request</DialogTitle>
        <DialogContent>
          <Alert severity="error">This is destructive and cannot be undone.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteRequestId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={submitDeleteRequest}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteCatalogId)} onClose={() => setDeleteCatalogId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#b91c1c' }}>Delete Item</DialogTitle>
        <DialogContent>
          <Alert severity="error">This will permanently remove the catalog record.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteCatalogId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={submitDeleteCatalog}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
