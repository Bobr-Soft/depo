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
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { api } from '../services/api';
import { isApproverRole, type UserRole } from '../utils/roles';

type ItemOption = {
  id: number;
  name: string;
  barcode?: string | null;
  quantity?: number | null;
};

type Rental = {
  id: number;
  status: string;
  requesterEmail: string | null;
  itemId: number;
  itemName: string | null;
  itemBarcode: string | null;
  quantity: number;
  purpose: string | null;
  reviewedByEmail: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  returnedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type RentingItemsMode = 'request' | 'manage';

export interface RentingItemsPageProps {
  role: UserRole;
  userEmail: string;
  forceMode?: RentingItemsMode;
}

function formatDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function normalizeStatus(status: string): string {
  return String(status || '').trim().toLowerCase();
}

function getStatusChipProps(statusRaw: string): { label: string; color: 'default' | 'warning' | 'success' | 'error' | 'info' } {
  const status = normalizeStatus(statusRaw);

  switch (status) {
    case 'pending':
      return { label: 'Függőben', color: 'warning' };
    case 'approved':
      return { label: 'Jóváhagyva', color: 'success' };
    case 'rejected':
      return { label: 'Elutasítva', color: 'error' };
    case 'cancelled':
      return { label: 'Visszavonva', color: 'default' };
    case 'returned':
      return { label: 'Visszahozva', color: 'info' };
    default:
      return { label: statusRaw || 'Ismeretlen', color: 'default' };
  }
}

const WRAP_CELL_SX = {
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  maxWidth: 420,
} as const;

export default function RentingItemsPage({ role, userEmail, forceMode }: RentingItemsPageProps) {
  const isApprover = isApproverRole(role);
  const mode: RentingItemsMode = forceMode ?? (isApprover ? 'manage' : 'request');

  // Shared state
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Worker/request view state
  const [items, setItems] = useState<ItemOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [requestedQuantity, setRequestedQuantity] = useState('1');
  const [purpose, setPurpose] = useState('');
  const [myRentals, setMyRentals] = useState<Rental[]>([]);

  // Approver/manage view state
  const [pendingRentals, setPendingRentals] = useState<Rental[]>([]);
  const [allRentals, setAllRentals] = useState<Rental[]>([]);
  const [allUserEmails, setAllUserEmails] = useState<string[]>([]);
  const [requesterFilterEmail, setRequesterFilterEmail] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewTarget, setReviewTarget] = useState<Rental | null>(null);

  const requesterOptions = useMemo(() => {
    if (role === 'admin' && allUserEmails.length > 0) {
      if (requesterFilterEmail && !allUserEmails.includes(requesterFilterEmail)) {
        return [requesterFilterEmail, ...allUserEmails];
      }
      return allUserEmails;
    }

    const emails = new Set<string>();
    for (const r of pendingRentals) {
      if (r.requesterEmail) emails.add(r.requesterEmail);
    }
    for (const r of allRentals) {
      if (r.requesterEmail) emails.add(r.requesterEmail);
    }
    const fallback = Array.from(emails).sort((a, b) => a.localeCompare(b));
    if (requesterFilterEmail && !fallback.includes(requesterFilterEmail)) {
      return [requesterFilterEmail, ...fallback];
    }
    return fallback;
  }, [allRentals, allUserEmails, pendingRentals, requesterFilterEmail, role]);

  const filteredPendingRentals = useMemo(() => {
    if (!requesterFilterEmail) return pendingRentals;
    return pendingRentals.filter((r) => r.requesterEmail === requesterFilterEmail);
  }, [pendingRentals, requesterFilterEmail]);

  const filteredAllRentals = useMemo(() => {
    if (!requesterFilterEmail) return allRentals;
    return allRentals.filter((r) => r.requesterEmail === requesterFilterEmail);
  }, [allRentals, requesterFilterEmail]);

  const canSubmitRequest = useMemo(() => {
    const qty = Number.parseInt(requestedQuantity, 10);
    return Boolean(selectedItem && Number.isInteger(qty) && qty > 0);
  }, [selectedItem, requestedQuantity]);

  const fetchItems = useCallback(async () => {
    const res = await api.get('/items');
    const rows = Array.isArray(res.data) ? res.data : [];
    setItems(
      rows.map((row: any) => ({
        id: Number(row.id),
        name: String(row.name ?? ''),
        barcode: row.barcode ?? null,
        quantity: row.quantity ?? null,
      }))
    );
  }, []);

  const fetchMy = useCallback(async () => {
    const res = await api.get('/rentals/my');
    setMyRentals(Array.isArray(res.data) ? res.data : []);
  }, []);

  const fetchPending = useCallback(async () => {
    const res = await api.get('/rentals/pending');
    setPendingRentals(Array.isArray(res.data) ? res.data : []);
  }, []);

  const fetchAll = useCallback(async () => {
    const res = await api.get('/rentals');
    setAllRentals(Array.isArray(res.data) ? res.data : []);
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await api.get('/users');
    const rows = Array.isArray(res.data) ? res.data : [];
    const emails = rows
      .map((row: any) => (typeof row?.email === 'string' ? row.email.trim() : ''))
      .filter(Boolean);
    setAllUserEmails(Array.from(new Set(emails)).sort((a, b) => a.localeCompare(b)));
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === 'request') {
        await Promise.all([fetchItems(), fetchMy()]);
      } else {
        if (role === 'admin') {
          await Promise.all([fetchPending(), fetchAll(), fetchUsers()]);
        } else {
          await Promise.all([fetchPending(), fetchAll()]);
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Hiba történt betöltés közben.');
    } finally {
      setLoading(false);
    }
  }, [fetchAll, fetchItems, fetchMy, fetchPending, fetchUsers, mode, role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateRequest = async () => {
    if (!canSubmitRequest || !selectedItem) return;

    setActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/rentals', {
        itemId: selectedItem.id,
        quantity: Number.parseInt(requestedQuantity, 10),
        purpose,
      });

      setSelectedItem(null);
      setRequestedQuantity('1');
      setPurpose('');
      setSuccess('Kölcsönzési igény elküldve. Jóváhagyásra vár.');
      await fetchMy();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nem sikerült elküldeni az igényt.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async (rentalId: number) => {
    setActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/rentals/${rentalId}/cancel`);
      setSuccess('Igény visszavonva.');
      await fetchMy();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nem sikerült visszavonni az igényt.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReturn = async (rentalId: number) => {
    setActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/rentals/${rentalId}/return`);
      setSuccess('Visszahozás rögzítve.');
      if (mode === 'request') {
        await fetchMy();
      } else {
        await Promise.all([fetchPending(), fetchAll()]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nem sikerült rögzíteni a visszahozást.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteReturnedRental = async (rentalId: number) => {
    setActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/rentals/${rentalId}`);
      setSuccess('Kölcsönzés törölve.');
      await Promise.all([fetchPending(), fetchAll()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nem sikerült törölni a kölcsönzést.');
    } finally {
      setActionBusy(false);
    }
  };

  const openReviewDialog = (target: Rental, action: 'approve' | 'reject') => {
    setReviewTarget(target);
    setReviewAction(action);
    setReviewNote('');
    setReviewDialogOpen(true);
  };

  const handleReviewConfirm = async () => {
    if (!reviewTarget) return;
    setActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const endpoint = reviewAction === 'approve' ? 'approve' : 'reject';
      await api.post(`/rentals/${reviewTarget.id}/${endpoint}`, { note: reviewNote });
      setSuccess(reviewAction === 'approve' ? 'Jóváhagyva.' : 'Elutasítva.');
      setReviewDialogOpen(false);
      setReviewTarget(null);
      await Promise.all([fetchPending(), fetchAll()]);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Nem sikerült menteni.');
    } finally {
      setActionBusy(false);
    }
  };

  if (mode === 'manage' && !isApprover) {
    return (
      <Box p={3}>
        <Typography variant="h5" color="error" gutterBottom>
          Hozzáférés megtagadva
        </Typography>
        <Typography variant="body1">A jóváhagyási felület csak admin vagy supervisor számára elérhető.</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {mode === 'manage' ? 'Kölcsönzések jóváhagyása' : 'Kölcsönzés igénylése'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bejelentkezve: {userEmail} • Szerepkör: {role}
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : mode === 'request' ? (
          <>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Új kölcsönzési igény
              </Typography>
              <Stack spacing={2}>
                <Autocomplete
                  options={items}
                  value={selectedItem}
                  onChange={(_, v) => setSelectedItem(v)}
                  getOptionLabel={(opt) => {
                    const barcodePart = opt.barcode ? ` (${opt.barcode})` : '';
                    return `${opt.name}${barcodePart}`;
                  }}
                  renderInput={(params) => <TextField {...params} label="Eszköz" />}
                />

                <TextField
                  label="Mennyiség"
                  type="number"
                  value={requestedQuantity}
                  onChange={(e) => setRequestedQuantity(e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText={
                    selectedItem?.quantity !== null && selectedItem?.quantity !== undefined
                      ? `Elérhető készlet: ${selectedItem.quantity}`
                      : undefined
                  }
                />

                <TextField
                  label="Indoklás / cél"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  multiline
                  minRows={2}
                />

                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={handleCreateRequest}
                    disabled={!canSubmitRequest || actionBusy}
                  >
                    Kérés elküldése
                  </Button>
                </Box>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Saját kölcsönzéseim
              </Typography>

              {myRentals.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nincs még kölcsönzési igényed.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Státusz</TableCell>
                      <TableCell>Eszköz</TableCell>
                      <TableCell>Mennyiség</TableCell>
                      <TableCell>Létrehozva</TableCell>
                      <TableCell>Megjegyzés</TableCell>
                      <TableCell align="right">Művelet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {myRentals.map((r) => {
                      const chip = getStatusChipProps(r.status);
                      const status = normalizeStatus(r.status);
                      const itemLabel = r.itemName || `#${r.itemId}`;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Chip size="small" label={chip.label} color={chip.color} />
                          </TableCell>
                          <TableCell>{itemLabel}</TableCell>
                          <TableCell>{r.quantity}</TableCell>
                          <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                          <TableCell>{r.reviewNote || ''}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              {status === 'pending' && (
                                <Button size="small" onClick={() => handleCancel(r.id)} disabled={actionBusy}>
                                  Visszavonás
                                </Button>
                              )}
                              {status === 'approved' && (
                                <Button size="small" variant="outlined" onClick={() => handleReturn(r.id)} disabled={actionBusy}>
                                  Visszahozva
                                </Button>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </>
        ) : (
          <>
            {role === 'admin' && (
              <Paper sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Autocomplete
                    options={requesterOptions}
                    value={requesterFilterEmail}
                    onChange={(_, v) => setRequesterFilterEmail(v)}
                    isOptionEqualToValue={(opt, val) => opt === val}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Felhasználó szűrő"
                        placeholder="Összes"
                      />
                    )}
                    sx={{ minWidth: { xs: '100%', sm: 360 } }}
                    disabled={requesterOptions.length === 0}
                  />

                  <Button
                    variant="outlined"
                    onClick={() => setRequesterFilterEmail(null)}
                    disabled={!requesterFilterEmail}
                  >
                    Szűrés törlése
                  </Button>
                </Stack>
              </Paper>
            )}

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Függő kölcsönzési igények
              </Typography>

              {filteredPendingRentals.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {requesterFilterEmail ? 'Nincs találat a szűrésre.' : 'Nincs függő igény.'}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Igénylő</TableCell>
                      <TableCell>Eszköz</TableCell>
                      <TableCell>Mennyiség</TableCell>
                      <TableCell>Indoklás</TableCell>
                      <TableCell>Létrehozva</TableCell>
                      <TableCell align="right">Döntés</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPendingRentals.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.requesterEmail || ''}</TableCell>
                        <TableCell>{r.itemName || `#${r.itemId}`}</TableCell>
                        <TableCell>{r.quantity}</TableCell>
                        <TableCell>
                          <Box sx={WRAP_CELL_SX}>{r.purpose || ''}</Box>
                        </TableCell>
                        <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" variant="contained" onClick={() => openReviewDialog(r, 'approve')} disabled={actionBusy}>
                              Jóváhagyás
                            </Button>
                            <Button size="small" color="error" variant="outlined" onClick={() => openReviewDialog(r, 'reject')} disabled={actionBusy}>
                              Elutasítás
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Összes kölcsönzés
              </Typography>

              {filteredAllRentals.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {requesterFilterEmail ? 'Nincs találat a szűrésre.' : 'Még nincs kölcsönzés.'}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Státusz</TableCell>
                      <TableCell>Igénylő</TableCell>
                      <TableCell>Eszköz</TableCell>
                      <TableCell>Mennyiség</TableCell>
                      <TableCell>Létrehozva</TableCell>
                      <TableCell>Review</TableCell>
                      <TableCell align="right">Művelet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAllRentals.map((r) => {
                      const chip = getStatusChipProps(r.status);
                      const status = normalizeStatus(r.status);
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Chip size="small" label={chip.label} color={chip.color} />
                          </TableCell>
                          <TableCell>{r.requesterEmail || ''}</TableCell>
                          <TableCell>{r.itemName || `#${r.itemId}`}</TableCell>
                          <TableCell>{r.quantity}</TableCell>
                          <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                          <TableCell>
                            <Box sx={WRAP_CELL_SX}>
                              {r.reviewedByEmail ? `${r.reviewedByEmail}${r.reviewNote ? `: ${r.reviewNote}` : ''}` : ''}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            {(status === 'approved' || (role === 'admin' && status === 'returned')) && (
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                {status === 'approved' && (
                                  <Button size="small" variant="outlined" onClick={() => handleReturn(r.id)} disabled={actionBusy}>
                                    Visszahozva
                                  </Button>
                                )}
                                {role === 'admin' && status === 'returned' && (
                                  <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteReturnedRental(r.id)} disabled={actionBusy}>
                                    Törlés
                                  </Button>
                                )}
                              </Stack>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Paper>

            <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} fullWidth maxWidth="sm">
              <DialogTitle>{reviewAction === 'approve' ? 'Jóváhagyás' : 'Elutasítás'}</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {reviewTarget ? `Igény #${reviewTarget.id} • ${reviewTarget.itemName || reviewTarget.itemId} • ${reviewTarget.quantity} db` : ''}
                  </Typography>
                  <TextField
                    label="Megjegyzés (opcionális)"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    multiline
                    minRows={2}
                  />
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setReviewDialogOpen(false)} disabled={actionBusy}>Mégse</Button>
                <Button
                  variant="contained"
                  color={reviewAction === 'approve' ? 'primary' : 'error'}
                  onClick={handleReviewConfirm}
                  disabled={actionBusy}
                >
                  Mentés
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Stack>
    </Container>
  );
}