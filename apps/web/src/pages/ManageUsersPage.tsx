import { useState, useEffect } from 'react';
import { 
  Box, CircularProgress, Container, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, useTheme, useMediaQuery, Checkbox, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import { api } from '../services/api';
import AddIcon from '@mui/icons-material/Add';

interface User {
  id: number;
  username: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  created_at?: string;
}

export default function ManageUsersPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<User> | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const isEditing = Boolean(currentUser?.id);

  // Load users
  useEffect(() => {
    // API automatically handles 401 errors
    api.get('/users')
      .then(response => {
        setUsers(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading users:', error);
        setLoading(false);
      });
  }, []);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedUsers(users.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (id: number) => {
    setSelectedUsers(prev => {
      if (prev.includes(id)) {
        return prev.filter(userId => userId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleDeleteClick = () => {
    if (selectedUsers.length === 0) return;
    
    const usersToDelete = users.filter(user => selectedUsers.includes(user.id));
    const userNames = usersToDelete.map(user => user.username).join('", "');
    setUserToDelete({ id: 0, username: userNames } as User);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      console.log(`🔄 Deleting ${selectedUsers.length} users...`);
      await Promise.all(selectedUsers.map(id => api.delete(`/users/${id}`)));
      setUsers(users.filter(user => !selectedUsers.includes(user.id)));
      console.log(`✅ Successfully deleted ${selectedUsers.length} users`);
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      setSelectedUsers([]);
    } catch (error) {
      console.error('Error deleting users:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setUserToDelete(null);
  };

  const handleAddClick = () => {
    setCurrentUser({ role: 'Teacher' });
    setModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setCurrentUser(user);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCurrentUser(null);
  };

  const handleSave = async () => {
    if (!currentUser) return;
    
    try {
      if (isEditing) {
        // Edit existing user
        console.log(`🔄 Saving changes for user with id: ${currentUser.id}...`);
        const response = await api.put(`/users/${currentUser.id}`, currentUser);
        setUsers(users.map(user => 
          user.id === currentUser.id ? response.data : user
        ));
        console.log(`✅ Successfully updated user with id: ${currentUser.id}`);
      } else {
        // Add new user
        console.log('🔄 Adding new user...');
        const response = await api.post('/users', currentUser);
        setUsers([...users, response.data]);
        console.log('✅ Successfully added new user');
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleDeleteClick}
            startIcon={<DeleteIcon />}
            disabled={selectedUsers.length === 0}
          >
            Kijelöltek törlése ({selectedUsers.length})
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleAddClick}
            startIcon={<AddIcon />}
          >
            Hozzáadás
          </Button>
        </Box>
        <TableContainer component={Paper} sx={{ overflow: 'auto', px: 2 }}>
          <Table size={isMobile ? "small" : "medium"} sx={{ '& .MuiTableCell-root': { py: 1.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedUsers.length > 0 && selectedUsers.length < users.length}
                    checked={selectedUsers.length === users.length && users.length > 0}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Felhasználónév</TableCell>
                {!isMobile && <TableCell>Email</TableCell>}
                {!isTablet && <TableCell>Szerep</TableCell>}
                {!isTablet && <TableCell>Aktív</TableCell>}
                <TableCell sx={{ width: 80 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      inputProps={{ 'aria-label': 'select user' }}
                    />
                  </TableCell>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 0.5
                    }}>
                      {user.username}
                      {(isMobile || isTablet) && (
                        <Box sx={{ 
                          typography: 'caption',
                          color: 'text.secondary',
                          display: 'flex',
                          gap: 1,
                          flexWrap: 'wrap'
                        }}>
                          {isTablet && <span>👤 {user.role || 'N/A'}</span>}
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  {!isMobile && <TableCell>{user.email || 'N/A'}</TableCell>}
                  {!isTablet && <TableCell>{user.role || 'N/A'}</TableCell>}
                  {!isTablet && <TableCell>{user.isActive ? 'Igen' : 'Nem'}</TableCell>}
                  <TableCell sx={{ width: 80, textAlign: 'center', verticalAlign: 'middle' }}>
                    <IconButton 
                      onClick={() => handleEdit(user)} 
                      color="primary"
                      size={isMobile ? "small" : "medium"}
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            Are you sure you want to delete {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}?
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Mégse</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Törlés
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit/Add Dialog */}
      <Dialog 
        open={modalOpen} 
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{isEditing ? 'Szerkesztés' : 'Új hozzáadása'}</DialogTitle>
        <DialogContent>
          <Box sx={{ 
            pt: 2, 
            px: 1,
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3,
            '& .MuiFormControl-root': {
              minWidth: '100%'
            }
          }}>
            <TextField
              label="Email"
              type="email"
              value={currentUser?.email || ''}
              onChange={(e) => setCurrentUser(prev => prev ? {...prev, email: e.target.value} : null)}
              size="medium"
              fullWidth
            />
            {!isEditing && (
              <TextField
                label="Jelszó"
                type="password"
                value={(currentUser as any)?.password || ''}
                onChange={(e) => setCurrentUser(prev => prev ? {...prev, password: e.target.value} : null)}
                size="medium"
                fullWidth
              />
            )}
            <FormControl fullWidth>
              <InputLabel>Szerep</InputLabel>
              <Select
                value={currentUser?.role || 'Teacher'}
                label="Szerep"
                onChange={(e) => setCurrentUser(prev => prev ? {...prev, role: e.target.value} : null)}
              >
                <MenuItem value="Teacher">Teacher</MenuItem>
                <MenuItem value="Admin">Admin</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Checkbox
                checked={currentUser?.isActive ?? true}
                onChange={(e) => setCurrentUser(prev => prev ? {...prev, isActive: e.target.checked} : null)}
              />
              <span>Active</span>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Mégse</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            {isEditing ? 'Save Changes' : 'Add User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
