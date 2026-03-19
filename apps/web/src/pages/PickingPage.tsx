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
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
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
} from '@mui/material';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit2,
  ListTodo,
  Minus,
  Package,
  Plus,
  Search,
  Shield,
  Trash2,
  User,
  UserPlus,
  Timer,
} from 'lucide-react';
import { api } from '../services/api';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type Priority = 'normal' | 'urgent';
type RequestStatus = 'pending' | 'picking' | 'transit' | 'delivered';
type RoleMode = 'OPERATOR' | 'ADMIN';

type CatalogItem = { id: number; name: string; code: string; barcode: string; category: string; stock: number; location?: string; };
type ActiveRequest = { id: string; name?: string; line: string; status: RequestStatus; totalItems: number; createdAt: string | Date; deadline?: string | Date; priority: Priority; };
type AdminRequest = { id: string; taskId: number; name: string; line: string; status: RequestStatus; priority: Priority; totalItems: number; pickedItems: number; assignedUserId: number | null; assignedUserEmail: string | null; createdAt: string | Date; updatedAt: string | Date; deadline?: string | Date; };
type MaterialRequestDetail = { id: string; taskId: number; line: string; status: RequestStatus; priority: Priority; assignedUserId: number | null; warning?: string | null; items: Array<{ itemId: number; requestedQuantity: number; name: string; }>; };
type UserOption = { id: number; email: string };
type CatalogForm = { id: number | null; name: string; code: string; location: string; stock: string };
type ApiError = { response?: { status?: number } };

type ItemApiModel = {
  id: number;
  name: string;
  barcode?: string | null;
  category?: string | null;
  quantity?: number | null;
  description?: string | null;
};

type MaterialRequestApiModel = {
  id: string;
  taskId: number;
  name?: string;
  line: string;
  status: string;
  priority: Priority;
  totalItems: number;
  pickedItems?: number;
  assignedUserId?: number | null;
  assignedUserEmail?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  deadline?: string | Date;
};

type UserApiModel = { id: number; email: string };

const statusMeta: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#f59e0b' },
  picking: { label: 'Picking', color: '#3b82f6' },
  transit: { label: 'In Transit', color: '#8b5cf6' },
  delivered: { label: 'Delivered', color: '#22c55e' },
};

const statusCycle: RequestStatus[] = ['pending', 'picking', 'transit', 'delivered'];

const resolveError = (status?: number, fallback = 'Unexpected error.') => {
  if (!status) return 'API server is unreachable.';
  if (status === 401 || status === 403) return 'Permission denied or session expired.';
  if (status === 503) return 'Database is temporarily unavailable.';
  return fallback;
};

const mapStatus = (status: string): RequestStatus => {
  const raw = String(status || '').toLowerCase();
  if (raw === 'delivered') return 'delivered';
  if (raw === 'picking') return 'picking';
  if (raw === 'transit') return 'transit';
  return 'pending';
};

const getErrorStatus = (error: unknown): number | undefined => {
  const candidate = error as ApiError;
  return candidate.response?.status;
};

// Reusable styling for KPI cards matching the OverviewPage
const kpiCardSx = {
  p: 2.5,
  height: '100%',
  transition: 'transform 0.2s, box-shadow 0.2s',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: 4,
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PickingPage({ userRole }: { userRole?: string }) {
  // --- UI & Mode State ---
  const [roleMode, setRoleMode] = useState<RoleMode>(String(userRole || '').trim().toLowerCase() === 'admin' ? 'ADMIN' : 'OPERATOR');
  const [line, setLine] = useState('SMT-01');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Data State ---
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [operatorRequests, setOperatorRequests] = useState<ActiveRequest[]>([]);
  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [metrics, setMetrics] = useState({ activeRequests: 0, urgentRequests: 0, totalRequests: 0 });

  // --- Builder / Cart State ---
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [priority, setPriority] = useState<Priority>('normal');

  // --- Loading States ---
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isRequestsLoading, setIsRequestsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Dialog States ---
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);
  const [deleteCatalogId, setDeleteCatalogId] = useState<number | null>(null);
  const [assignRequestId, setAssignRequestId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>('');
  const [editRequest, setEditRequest] = useState<MaterialRequestDetail | null>(null);
  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [catalogForm, setCatalogForm] = useState<CatalogForm>({ id: null, name: '', code: '', location: '', stock: '0' });

  useEffect(() => { setRoleMode(String(userRole || '').trim().toLowerCase() === 'admin' ? 'ADMIN' : 'OPERATOR'); }, [userRole]);

  // --- Memoized Values ---
  const categories = useMemo(() => ['All', ...Array.from(new Set(catalog.map((item) => item.category).filter(Boolean)))], [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      const catMatch = selectedCategory === 'All' || item.category === selectedCategory;
      const searchMatch = !q || item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q) || item.barcode.toLowerCase().includes(q);
      return catMatch && searchMatch;
    });
  }, [catalog, search, selectedCategory]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ item: catalog.find((c) => c.id === Number(id))!, quantity: qty }))
      .filter((v) => v.item);
  }, [cart, catalog]);

  // --- Fetchers ---
  const fetchCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    try {
      const res = await api.get<ItemApiModel[]>('/items');
      setCatalog((res.data || []).map((item) => ({
        id: item.id, name: item.name, code: item.barcode || `ITM-${item.id}`, barcode: item.barcode || '',
        category: item.category || 'Uncategorized', stock: Math.max(0, Number(item.quantity || 0)), location: item.description || ''
      })));
      setErrorMessage(null);
    } catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Failed to load item catalog.')); }
    finally { setIsCatalogLoading(false); }
  }, []);

  const fetchOperatorRequests = useCallback(async () => {
    setIsRequestsLoading(true);
    try {
      const res = await api.get<MaterialRequestApiModel[]>('/material-requests', { params: { line } });
      setOperatorRequests((res.data || []).map((r) => ({
        id: r.id,
        name: r.name || `REQ-${r.id.substring(0, 4)}`,
        line: r.line,
        status: mapStatus(r.status),
        totalItems: Number(r.totalItems || 0),
        createdAt: r.createdAt,
        deadline: r.deadline,
        priority: r.priority,
      })));
      setErrorMessage(null);
    } catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Failed to load line requests.')); }
    finally { setIsRequestsLoading(false); }
  }, [line]);

  const fetchAdminRequests = useCallback(async () => {
    setIsRequestsLoading(true);
    try {
      const [reqRes, metRes, usrRes] = await Promise.all([
        api.get<MaterialRequestApiModel[]>('/material-requests/all'), api.get('/material-requests/metrics'), api.get<UserApiModel[]>('/users')
      ]);
      setAdminRequests((reqRes.data || []).map((r) => ({
        id: r.id,
        taskId: r.taskId,
        name: r.name || `REQ-${r.id.substring(0, 4)}`,
        line: r.line,
        status: mapStatus(r.status),
        priority: r.priority,
        totalItems: Number(r.totalItems || 0),
        pickedItems: Number(r.pickedItems || 0),
        assignedUserId: r.assignedUserId ?? null,
        assignedUserEmail: r.assignedUserEmail ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        deadline: r.deadline,
      })));
      setMetrics({
        activeRequests: Number(metRes.data?.activeRequests || 0), urgentRequests: Number(metRes.data?.urgentRequests || 0), totalRequests: Number(metRes.data?.totalRequests || 0)
      });
      setUsers((usrRes.data || []).map((u) => ({ id: u.id, email: u.email })));
      setErrorMessage(null);
    } catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Failed to load admin data.')); }
    finally { setIsRequestsLoading(false); }
  }, []);

  // --- Initial Loads ---
  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);
  useEffect(() => {
    if (roleMode === 'ADMIN') {
      fetchAdminRequests();
      return;
    }
    fetchOperatorRequests();
  }, [roleMode, fetchAdminRequests, fetchOperatorRequests]);

  const refreshRequests = () => roleMode === 'ADMIN' ? fetchAdminRequests() : fetchOperatorRequests();

  // --- Helpers ---
  const calculateDeadline = (priorityLevel: Priority) => {
    const date = new Date();
    if (priorityLevel === 'urgent') {
      date.setHours(date.getHours() + 1);
    } else {
      date.setDate(date.getDate() + 2);
    }
    return date.toISOString();
  };

  // --- Action Handlers ---
  const setQuantity = (id: number, qty: number) => {
    setCart((prev) => { const next = { ...prev }; if (qty <= 0) delete next[id]; else next[id] = qty; return next; });
  };

  const handleSubmitRequest = async () => {
    if (!cartItems.length) return;
    setIsSubmitting(true);
    try {
      const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dynamicName = `REQ: ${line} - ${currentTimeStr} (${cartItems.length} items)`;
      const deadlineIso = calculateDeadline(priority);

      await api.post('/material-requests', {
        name: dynamicName,
        line,
        priority,
        deadline: deadlineIso,
        items: cartItems.map((c) => ({ itemId: c.item.id, quantity: c.quantity }))
      });

      setCart({});
      setPriority('normal');
      await refreshRequests();
    } catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Request submission failed.')); }
    finally { setIsSubmitting(false); }
  };

  const cycleStatus = async (request: AdminRequest) => {
    const nextStatus = statusCycle[(statusCycle.indexOf(request.status) + 1) % statusCycle.length];
    try { await api.put(`/material-requests/${request.id}/status`, { status: nextStatus }); await fetchAdminRequests(); }
    catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Status update failed.')); }
  };

  const submitAssign = async () => {
    if (!assignRequestId) return;
    try {
      await api.put(`/material-requests/${assignRequestId}/assign`, { assignedUserId: assignUserId ? Number(assignUserId) : null });
      setAssignRequestId(null); await fetchAdminRequests();
    } catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Assignment failed.')); }
  };

  const openEditRequest = async (id: string) => {
    try { const res = await api.get(`/material-requests/${id}`); setEditRequest(res.data); }
    catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Failed to load request details.')); }
  };

  const submitEditRequest = async () => {
    if (!editRequest) return;
    try {
      const deadlineIso = calculateDeadline(editRequest.priority);
      await api.put(`/material-requests/${editRequest.id}`, {
        line: editRequest.line,
        priority: editRequest.priority,
        deadline: deadlineIso,
        items: editRequest.items.map((i) => ({ itemId: i.itemId, quantity: i.requestedQuantity }))
      });

      setEditRequest(null);
      await fetchAdminRequests();
    } catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Request edit failed.')); }
  };

  const submitDeleteRequest = async () => {
    if (!deleteRequestId) return;
    try { await api.delete(`/material-requests/${deleteRequestId}`); setDeleteRequestId(null); refreshRequests(); }
    catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Delete failed.')); }
  };

  const submitCatalogForm = async () => {
    const payload = { name: catalogForm.name, barcode: catalogForm.code, description: catalogForm.location, quantity: Number(catalogForm.stock || 0) };
    try {
      if (catalogForm.id) {
        await api.put(`/items/${catalogForm.id}`, payload);
      } else {
        await api.post('/items', payload);
      }
      setCatalogFormOpen(false); await fetchCatalog();
    } catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Catalog save failed.')); }
  };

  const submitDeleteCatalog = async () => {
    if (!deleteCatalogId) return;
    try { await api.delete(`/items/${deleteCatalogId}`); setDeleteCatalogId(null); await fetchCatalog(); }
    catch (err: unknown) { setErrorMessage(resolveError(getErrorStatus(err), 'Item delete failed.')); }
  };

  // ============================================================================
  // RENDER: OPERATOR VIEW (Floor View)
  // ============================================================================
  const renderOperatorView = () => (
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr' }, alignItems: 'start' }}>

      {/* LEFT: Catalog */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
        <Typography variant="h6" fontWeight={600} mb={2}>Material Catalog</Typography>

        <TextField
          fullWidth
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search catalog..."
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }}
          sx={{ mb: 2 }}
        />

        <Stack direction="row" spacing={1} mb={2} sx={{ overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 } }}>
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => setSelectedCategory(cat)}
              color={selectedCategory === cat ? 'primary' : 'default'}
              variant={selectedCategory === cat ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>

        <Stack spacing={1.5} sx={{ overflowY: 'auto', flex: 1, pr: 1 }}>
          {isCatalogLoading ? <CircularProgress sx={{ alignSelf: 'center', mt: 4 }} /> :
            filteredCatalog.map((item) => {
              const qty = cart[item.id] || 0;
              return (
                <Paper key={item.id} variant="outlined" sx={{ p: 1.5, borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography fontWeight={600} color="text.primary">{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.code} • Available: <Typography component="span" color="success.main" fontWeight="bold">{item.stock}</Typography>
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <IconButton onClick={() => setQuantity(item.id, Math.max(0, qty - 1))} sx={{ bgcolor: 'action.hover', width: 36, height: 36 }}><Minus size={16} /></IconButton>
                      <Typography sx={{ minWidth: 24, textAlign: 'center', fontWeight: 'bold' }}>{qty}</Typography>
                      <IconButton onClick={() => setQuantity(item.id, qty + 1)} sx={{ bgcolor: 'action.hover', width: 36, height: 36 }}><Plus size={16} /></IconButton>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })
          }
        </Stack>
      </Paper>

      {/* RIGHT: Cart & Live Tracking */}
      <Stack spacing={3} sx={{ height: 'calc(100vh - 160px)' }}>

        {/* CART */}
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>Current Request</Typography>
          <Stack spacing={1.5} sx={{ flex: 1, overflowY: 'auto', mb: 2, pr: 1 }}>
            {cartItems.length === 0 ? <Typography color="text.secondary" textAlign="center" mt={4}>No items selected</Typography> :
              cartItems.map(({ item, quantity }) => (
                <Paper key={item.id} variant="outlined" sx={{ p: 1.5, borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography fontWeight={600} color="text.primary">{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Req: <Typography component="span" color="text.primary" fontWeight="bold">{quantity}</Typography>
                      </Typography>
                      {quantity > item.stock && <Typography variant="caption" color="warning.main" display="flex" alignItems="center" gap={0.5} mt={0.5}><AlertTriangle size={12} /> Partial fill expected</Typography>}
                    </Box>
                    <IconButton onClick={() => setQuantity(item.id, 0)} color="error"><Trash2 size={18} /></IconButton>
                  </Stack>
                </Paper>
              ))
            }
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <ToggleButtonGroup exclusive fullWidth size="small" value={priority} onChange={(_, v) => v && setPriority(v)} sx={{ mb: 2 }}>
            <ToggleButton value="normal">Normal</ToggleButton>
            <ToggleButton value="urgent" color="error">Urgent</ToggleButton>
          </ToggleButtonGroup>
          <Button fullWidth variant="contained" disabled={!cartItems.length || isSubmitting} onClick={handleSubmitRequest} sx={{ py: 1.5, fontWeight: 'bold', fontSize: '1.05rem' }}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </Paper>

        {/* LIVE TRACKING */}
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>Live Tracking</Typography>
          <Stack spacing={1.5} sx={{ overflowY: 'auto', flex: 1, pr: 1 }}>
            {isRequestsLoading ? <CircularProgress sx={{ alignSelf: 'center', mt: 4 }} /> :
              operatorRequests.length === 0 ? <Typography color="text.secondary" textAlign="center" mt={4}>No active requests for {line}</Typography> :
              operatorRequests.map((req) => {
                const meta = statusMeta[req.status];
                return (
                  <Paper key={req.id} variant="outlined" sx={{ p: 1.5, borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography fontWeight={700} color="text.primary">{req.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{req.totalItems} items</Typography>

                        <Stack direction="row" spacing={0.8} alignItems="center" mt={1}>
                          {req.status === 'delivered' ? <CheckCircle size={14} color={meta.color} /> : <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: meta.color }} />}
                          <Typography variant="body2" sx={{ color: meta.color, fontWeight: 700 }}>{meta.label}</Typography>
                        </Stack>

                        {req.deadline && req.status !== 'delivered' && (
                          <Typography variant="caption" sx={{ color: req.priority === 'urgent' ? 'error.main' : 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <Timer size={12} /> Due: {new Date(req.deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </Typography>
                        )}
                      </Box>
                      <Stack alignItems="flex-end" spacing={1}>
                        {req.priority === 'urgent' && <Chip label="P1" size="small" color="error" variant="outlined" sx={{ fontWeight: 'bold' }} />}
                        {req.status === 'pending' && <IconButton size="small" onClick={() => { setDeleteRequestId(req.id); }} color="error"><Trash2 size={16} /></IconButton>}
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })
            }
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );

  // ============================================================================
  // RENDER: ADMIN VIEW (Dispatch & Management)
  // ============================================================================
  const renderAdminView = () => (
    <Stack spacing={3}>
      {/* KPI METRICS */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Box sx={{ flex: 1 }}>
          <Paper elevation={2} sx={kpiCardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Active Orders</Typography>
                <Typography variant="h4" fontWeight="bold" color="text.primary">{metrics.activeRequests}</Typography>
              </Box>
              <ListTodo size={42} color="#667eea" style={{ opacity: 0.8 }} />
            </Box>
          </Paper>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Paper elevation={2} sx={kpiCardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Urgent / Line Stop</Typography>
                <Typography variant="h4" fontWeight="bold" color="text.primary">{metrics.urgentRequests}</Typography>
              </Box>
              <AlertTriangle size={42} color="#ef5350" style={{ opacity: 0.8 }} />
            </Box>
          </Paper>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Paper elevation={2} sx={kpiCardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Completed Today</Typography>
                <Typography variant="h4" fontWeight="bold" color="text.primary">{metrics.totalRequests - metrics.activeRequests}</Typography>
              </Box>
              <CheckCircle size={42} color="#43e97b" style={{ opacity: 0.8 }} />
            </Box>
          </Paper>
        </Box>
      </Stack>

      {/* REQUESTS TABLE */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, overflowX: 'auto' }}>
        <Typography variant="h6" fontWeight={600} mb={2}>Active Material Requests</Typography>
        {isRequestsLoading ? <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box> : (
          <Table size="small" sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Request</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Line</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Progress</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Assigned</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Time / Deadline</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {adminRequests.map((req) => {
                const progress = req.totalItems > 0 ? (req.pickedItems / req.totalItems) * 100 : 0;
                return (
                  <TableRow key={req.id} hover>
                    <TableCell>
                      <Typography fontWeight={600} color="text.primary">{req.name}</Typography>
                      <Typography variant="caption" color="text.secondary">ID: {req.id}</Typography>
                    </TableCell>
                    <TableCell>{req.line} {req.priority === 'urgent' && <Typography component="span" color="error.main" fontWeight="bold" fontSize="0.75rem" ml={1}>URGENT</Typography>}</TableCell>
                    <TableCell>
                      <Chip label={statusMeta[req.status].label} onClick={() => cycleStatus(req)} size="small"
                        sx={{ bgcolor: `${statusMeta[req.status].color}20`, color: statusMeta[req.status].color, border: `1px solid ${statusMeta[req.status].color}40`, fontWeight: 'bold', cursor: 'pointer' }} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: '100%' }}><LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: progress === 100 ? '#22c55e' : '#3b82f6' } }} /></Box>
                        <Typography variant="caption" color="text.secondary">{req.pickedItems}/{req.totalItems}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Button size="small" startIcon={req.assignedUserId ? <User size={14} /> : <UserPlus size={14} />} onClick={() => { setAssignRequestId(req.id); setAssignUserId(req.assignedUserId ? String(req.assignedUserId) : ''); }}
                        sx={{ color: req.assignedUserId ? 'text.primary' : 'text.secondary', textTransform: 'none' }}>
                        {req.assignedUserEmail || 'Assign...'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={0.5}><Clock size={12}/>{new Date(req.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Typography>
                      {req.deadline && <Typography variant="caption" color={req.priority === 'urgent' ? 'error.main' : 'text.secondary'} display="flex" alignItems="center" gap={0.5} mt={0.5}><Timer size={12}/>Due: {new Date(req.deadline).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton size="small" onClick={() => openEditRequest(req.id)} color="primary"><Edit2 size={16} /></IconButton>
                        <IconButton size="small" onClick={() => setDeleteRequestId(req.id)} color="error"><Trash2 size={16} /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {adminRequests.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>No active requests</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* CATALOG MANAGEMENT */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={600}>Catalog Database</Typography>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => { setCatalogForm({ id: null, name: '', code: '', location: '', stock: '0' }); setCatalogFormOpen(true); }}>Add Item</Button>
        </Stack>
        <Stack spacing={1.5} sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
          {catalog.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ p: 1.5, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography fontWeight={600}>{item.name}</Typography>
                <Typography variant="body2" color="text.secondary">{item.code} • Category: {item.category} • Location: {item.location || 'N/A'}</Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" fontWeight="bold" mr={2}>Stock: {item.stock}</Typography>
                <IconButton onClick={() => { setCatalogForm({ id: item.id, name: item.name, code: item.barcode || item.code, location: item.location || '', stock: String(item.stock) }); setCatalogFormOpen(true); }} size="small" color="primary" sx={{ bgcolor: 'action.hover' }}><Edit2 size={16} /></IconButton>
                <IconButton onClick={() => setDeleteCatalogId(item.id)} size="small" color="error" sx={{ bgcolor: 'action.hover' }}><Trash2 size={16} /></IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );

  // ============================================================================
  // MAIN RETURN
  // ============================================================================
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Stack spacing={3}>

        {/* TOP APP BAR */}
        <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
              <Package color="#667eea" /> DEPO WMS
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center">
              {roleMode === 'OPERATOR' && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Line</InputLabel>
                  <Select value={line} label="Line" onChange={(e) => setLine(e.target.value)}>
                    <MenuItem value="SMT-01">Line: SMT-01</MenuItem>
                    <MenuItem value="Assembly-B">Line: Assembly-B</MenuItem>
                  </Select>
                </FormControl>
              )}

              <ToggleButtonGroup exclusive size="small" value={roleMode} onChange={(_, v) => v && setRoleMode(v)}>
                <ToggleButton value="OPERATOR">Floor View</ToggleButton>
                <ToggleButton value="ADMIN"><Shield size={16} style={{marginRight: 4}}/> Dispatch</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
        </Paper>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {/* CONTENT RENDERER */}
        {roleMode === 'ADMIN' ? renderAdminView() : renderOperatorView()}
      </Stack>

      {/* =====================================================================
          DIALOGS (Modals)
          ===================================================================== */}

      {/* Assign User Dialog */}
      <Dialog open={Boolean(assignRequestId)} onClose={() => setAssignRequestId(null)}>
        <DialogTitle>Assign Picker to Task</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Select Worker</InputLabel>
            <Select value={assignUserId} label="Select Worker" onChange={(e) => setAssignUserId(e.target.value)}>
              <MenuItem value=""><em>Unassigned</em></MenuItem>
              {users.map((u) => <MenuItem key={u.id} value={String(u.id)}>{u.email}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAssignRequestId(null)} color="inherit">Cancel</Button>
          <Button onClick={submitAssign} variant="contained" color="primary">Assign</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Request Dialog */}
      <Dialog open={Boolean(editRequest)} onClose={() => setEditRequest(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Request {editRequest?.id}</DialogTitle>
        <DialogContent>
          {editRequest && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth label="Production Line" value={editRequest.line} onChange={(e) => setEditRequest(prev => prev ? { ...prev, line: e.target.value } : prev)} />
              <ToggleButtonGroup exclusive value={editRequest.priority} onChange={(_, v) => v && setEditRequest(prev => prev ? { ...prev, priority: v } : prev)} fullWidth>
                <ToggleButton value="normal">Normal</ToggleButton>
                <ToggleButton value="urgent" color="error">Urgent</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="subtitle2" color="text.secondary" mt={2}>Requested Items</Typography>
              {editRequest.items.map((item) => (
                <Paper key={item.itemId} variant="outlined" sx={{ p: 1.5, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography>{item.name}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton size="small" onClick={() => setEditRequest(prev => prev ? { ...prev, items: prev.items.map(i => i.itemId === item.itemId ? { ...i, requestedQuantity: Math.max(1, i.requestedQuantity - 1) } : i) } : prev)} sx={{ bgcolor: 'action.hover' }}><Minus size={14} /></IconButton>
                    <Typography sx={{ minWidth: 24, textAlign: 'center', fontWeight: 'bold' }}>{item.requestedQuantity}</Typography>
                    <IconButton size="small" onClick={() => setEditRequest(prev => prev ? { ...prev, items: prev.items.map(i => i.itemId === item.itemId ? { ...i, requestedQuantity: i.requestedQuantity + 1 } : i) } : prev)} sx={{ bgcolor: 'action.hover' }}><Plus size={14} /></IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditRequest(null)} color="inherit">Cancel</Button>
          <Button onClick={submitEditRequest} variant="contained" color="primary">Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* Catalog Form Dialog */}
      <Dialog open={catalogFormOpen} onClose={() => setCatalogFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{catalogForm.id ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={catalogForm.name} onChange={(e) => setCatalogForm(prev => ({ ...prev, name: e.target.value }))} />
            <TextField label="Barcode/Code" value={catalogForm.code} onChange={(e) => setCatalogForm(prev => ({ ...prev, code: e.target.value }))} />
            <TextField label="Location (Optional)" value={catalogForm.location} onChange={(e) => setCatalogForm(prev => ({ ...prev, location: e.target.value }))} />
            <TextField label="Stock Quantity" type="number" value={catalogForm.stock} onChange={(e) => setCatalogForm(prev => ({ ...prev, stock: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCatalogFormOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={submitCatalogForm} variant="contained" color="primary">Save Item</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialogs */}
      <Dialog open={Boolean(deleteRequestId)} onClose={() => setDeleteRequestId(null)}>
        <DialogTitle color="error.main">Delete Request</DialogTitle>
        <DialogContent><Typography color="text.secondary">Are you sure you want to permanently delete this request? This action cannot be undone.</Typography></DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setDeleteRequestId(null)} color="inherit">Cancel</Button><Button onClick={submitDeleteRequest} variant="contained" color="error">Delete</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteCatalogId)} onClose={() => setDeleteCatalogId(null)}>
        <DialogTitle color="error.main">Delete Catalog Item</DialogTitle>
        <DialogContent><Typography color="text.secondary">Are you sure you want to remove this item from the catalog? This may break historical requests.</Typography></DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setDeleteCatalogId(null)} color="inherit">Cancel</Button><Button onClick={submitDeleteCatalog} variant="contained" color="error">Delete</Button></DialogActions>
      </Dialog>

    </Container>
  );
}
