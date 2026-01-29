import { useState, useEffect } from 'react';
import { 
  Box, CircularProgress, Container, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel, useTheme, useMediaQuery, Checkbox} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import { api } from '../services/api';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

export interface Item {
  id: number;
  name: string;
  description: string;
  quantity: number;
  category_id: number;
  category?: string;
  location_id: number;
  location?: string;
}

interface Category {
  id: number;
  name: string;
}

interface Location {
  id: number;
  name: string;
}

export default function ListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<Item> | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const isEditing = Boolean(currentItem?.id);

  // Load categories and locations
  useEffect(() => {
    Promise.all([
      api.get('/categories'),
      api.get('/locations')
    ]).then(([categoriesRes, locationsRes]) => {
      setCategories(categoriesRes.data);
      setLocations(locationsRes.data);
    }).catch(error => {
      console.error('Error loading categories or locations:', error);
    });
  }, []);

  // Load items
  useEffect(() => {
    // Az api most már automatikusan kezeli a 401-es hibákat
    api.get('/items')
      .then(response => {
        setItems(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading items:', error);
        setLoading(false);
      });
  }, []);


  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedItems(items.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id: number) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleDeleteClick = () => {
    if (selectedItems.length === 0) return;
    
    const itemsToDelete = items.filter(item => selectedItems.includes(item.id));
    const itemNames = itemsToDelete.map(item => item.name).join('", "');
    setItemToDelete({ id: 0, name: itemNames } as Item);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedItems.length === 0) return;
    
    try {
      console.log(`🔄 Deleting ${selectedItems.length} items...`);
      await Promise.all(selectedItems.map(id => api.delete(`/items/${id}`)));
      setItems(items.filter(item => !selectedItems.includes(item.id)));
      console.log(`✅ Successfully deleted ${selectedItems.length} items`);
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      setSelectedItems([]);
    } catch (error) {
      console.error('Error deleting items:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };  

  const handleExportCSV = () => {
    const headers = ['ID', 'Név', 'Leírás', 'Mennyiség', 'Kategória', 'Hely'];

    const csvData = items.map(item => [
      item.id,
      item.name,
      item.description || '',
      item.quantity,
      item.category || '',
      item.location || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        row.map(cell => {
          const value = String(cell).replace(/"/g, '""');
          return value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\r\n');

    const BOM = '\uFEFF';
    
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'leltar_export.xls');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddClick = () => {
    setCurrentItem({});
    setModalOpen(true);
  };

  const handleEdit = (item: Item) => {
    setCurrentItem(item);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCurrentItem(null);
  };

  const handleSave = async () => {
    if (!currentItem) return;
    
    try {
      if (isEditing) {
        // Edit existing item
        console.log(`🔄 Saving changes for item with id: ${currentItem.id}...`);
        const response = await api.put(`/items/${currentItem.id}`, currentItem);
        setItems(items.map(item => 
          item.id === currentItem.id ? response.data : item
        ));
        console.log(`✅ Successfully updated item with id: ${currentItem.id}`);
      } else {
        // Add new item
        console.log('🔄 Adding new item...');
        const response = await api.post('/items', currentItem);
        setItems([...items, response.data]);
        console.log('✅ Successfully added new item');
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving item:', error);
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
//render add button

  return (

    <Container>
      <Box sx={{ mt: 4 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleDeleteClick}
            startIcon={<DeleteIcon />}
            disabled={selectedItems.length === 0}
          >
            Kijelöltek törlése ({selectedItems.length})
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleExportCSV}
              startIcon={<FileDownloadIcon />}
            >
              CSV Export
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
        </Box>
        <TableContainer component={Paper} sx={{ overflow: 'auto' }}>
          <Table size={isMobile ? "small" : "medium"}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedItems.length > 0 && selectedItems.length < items.length}
                    checked={selectedItems.length === items.length && items.length > 0}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Név</TableCell>
                {!isMobile && <TableCell>Leírás</TableCell>}
                <TableCell align="right">Mennyiség</TableCell>
                {!isTablet && <TableCell>Kategória</TableCell>}
                {!isMobile && <TableCell>Hely</TableCell>}
                <TableCell sx={{ minWidth: 110 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      inputProps={{ 'aria-label': 'select item' }}
                    />
                  </TableCell>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 0.5
                    }}>
                      {item.name}
                      {isMobile && (
                        <Box sx={{ 
                          typography: 'caption',
                          color: 'text.secondary',
                          display: 'flex',
                          gap: 1,
                          flexWrap: 'wrap'
                        }}>
                          {isTablet && <span>🏷️ {item.category || 'N/A'}</span>}
                          {isMobile && <span>📍 {item.location || 'N/A'}</span>}
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  {!isMobile && <TableCell>{item.description}</TableCell>}
                  <TableCell align="right">{item.quantity}</TableCell>
                  {!isTablet && <TableCell>{item.category || 'N/A'}</TableCell>}
                  {!isMobile && <TableCell>{item.location || 'N/A'}</TableCell>}
                  <TableCell>
                    <IconButton 
                      onClick={() => handleEdit(item)} 
                      color="primary"
                      size={isMobile ? "small" : "medium"}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleEdit(item)} 
                      color="primary"
                      size={isMobile ? "small" : "medium"}
                    >
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
                        Are you sure you want to delete {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''}?
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
              label="Név"
              value={currentItem?.name || ''}
              onChange={(e) => setCurrentItem(prev => prev ? {...prev, name: e.target.value} : null)}
              size="medium"
              fullWidth
            />
            <TextField
              label="Leírás"
              value={currentItem?.description || ''}
              onChange={(e) => setCurrentItem(prev => prev ? {...prev, description: e.target.value} : null)}
              size="medium"
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Mennyiség"
              type="number"
              value={currentItem?.quantity || ''}
              onChange={(e) => setCurrentItem(prev => prev ? {...prev, quantity: Number(e.target.value)} : null)}
              size="medium"
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Kategória</InputLabel>
              <Select
                value={currentItem?.category_id || ''}
                label="Kategória"
                onChange={(e) => setCurrentItem(prev => prev ? {...prev, category_id: Number(e.target.value)} : null)}
              >
                {categories.map(category => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Hely</InputLabel>
              <Select
                value={currentItem?.location_id || ''}
                label="Hely"
                onChange={(e) => setCurrentItem(prev => prev ? {...prev, location_id: Number(e.target.value)} : null)}
              >
                {locations.map(location => (
                  <MenuItem key={location.id} value={location.id}>
                    {location.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Mégse</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            {isEditing ? 'Save Changes' : 'Add Item'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}