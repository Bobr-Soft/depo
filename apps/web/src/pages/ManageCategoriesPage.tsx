import { useState, useEffect } from 'react';
import {
  Box, CircularProgress, Container, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, useTheme, useMediaQuery, Checkbox
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import { api } from '../services/api';
import AddIcon from '@mui/icons-material/Add';

interface Category {
  id: number;
  name: string;
  description?: string;
}

export default function ManageCategoriesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Partial<Category> | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const isEditing = Boolean(currentCategory?.id);

  // Load categories
  useEffect(() => {
    // API automatically handles 401 errors
    api.get('/categories')
      .then(response => {
        setCategories(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading categories:', error);
        setLoading(false);
      });
  }, []);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedCategories(categories.map(category => category.id));
    } else {
      setSelectedCategories([]);
    }
  };

  const handleSelectCategory = (id: number) => {
    setSelectedCategories(prev => {
      if (prev.includes(id)) {
        return prev.filter(categoryId => categoryId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleDeleteClick = () => {
    if (selectedCategories.length === 0) return;

    const categoriesToDelete = categories.filter(category => selectedCategories.includes(category.id));
    const categoryNames = categoriesToDelete.map(category => category.name).join('", "');
    setCategoryToDelete({ id: 0, name: categoryNames } as Category);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedCategories.length === 0) return;

    try {
      console.log(`🔄 Deleting ${selectedCategories.length} categories...`);
      await Promise.all(selectedCategories.map(id => api.delete(`/categories/${id}`)));
      setCategories(categories.filter(category => !selectedCategories.includes(category.id)));
      console.log(`✅ Successfully deleted ${selectedCategories.length} categories`);
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
      setSelectedCategories([]);
    } catch (error) {
      console.error('Error deleting categories:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setCategoryToDelete(null);
  };

  const handleAddClick = () => {
    setCurrentCategory({});
    setModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setCurrentCategory(category);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCurrentCategory(null);
  };

  const handleSave = async () => {
    if (!currentCategory) return;

    try {
      if (isEditing) {
        // Edit existing category
        console.log(`🔄 Saving changes for category with id: ${currentCategory.id}...`);
        const response = await api.put(`/categories/${currentCategory.id}`, currentCategory);
        setCategories(categories.map(category =>
          category.id === currentCategory.id ? response.data : category
        ));
        console.log(`✅ Successfully updated category with id: ${currentCategory.id}`);
      } else {
        // Add new category
        console.log('🔄 Adding new category...');
        const response = await api.post('/categories', currentCategory);
        setCategories([...categories, response.data]);
        console.log('✅ Successfully added new category');
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving category:', error);
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
            disabled={selectedCategories.length === 0}
          >
            Kijelöltek törlése ({selectedCategories.length})
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
                    indeterminate={selectedCategories.length > 0 && selectedCategories.length < categories.length}
                    checked={selectedCategories.length === categories.length && categories.length > 0}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Név</TableCell>
                {!isMobile && <TableCell>Leírás</TableCell>}
                <TableCell sx={{ width: 80 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => handleSelectCategory(category.id)}
                      inputProps={{ 'aria-label': 'select category' }}
                    />
                  </TableCell>
                  <TableCell>{category.id}</TableCell>
                  <TableCell>{category.name}</TableCell>
                  {!isMobile && <TableCell>{category.description || 'N/A'}</TableCell>}
                  <TableCell sx={{ width: 80, textAlign: 'center', verticalAlign: 'middle' }}>
                    <IconButton
                      onClick={() => handleEdit(category)}
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
            Are you sure you want to delete {selectedCategories.length} categor{selectedCategories.length !== 1 ? 'ies' : 'y'}?
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
              value={currentCategory?.name || ''}
              onChange={(e) => setCurrentCategory(prev => prev ? {...prev, name: e.target.value} : null)}
              size="medium"
              fullWidth
            />
            <TextField
              label="Leírás"
              value={currentCategory?.description || ''}
              onChange={(e) => setCurrentCategory(prev => prev ? {...prev, description: e.target.value} : null)}
              size="medium"
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Mégse</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            {isEditing ? 'Save Changes' : 'Add Category'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
