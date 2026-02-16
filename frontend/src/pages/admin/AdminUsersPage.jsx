import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Search, Users, Shield, ShieldCheck, ShieldX, Eye, 
  Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight,
  Loader2, UserCheck, UserX, Briefcase, Calendar, Download
} from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useConfirmDialog } from '../../components/ui/confirm-dialog';

// Skeleton Animation Component
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
);

// Skeleton User Card
const UserCardSkeleton = () => (
  <div className="glass-card rounded-xl p-5 border border-slate-800">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-6 w-20 rounded" />
    </div>
    <div className="grid grid-cols-2 gap-3 mb-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-24" />
    </div>
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-3 w-36" />
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
      <Skeleton className="h-4 w-16" />
      <div className="flex gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  </div>
);

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrateur', icon: ShieldCheck, color: 'text-red-400 bg-red-500/20' },
  { value: 'premium', label: 'Premium', icon: Shield, color: 'text-gold bg-gold/20' },
  { value: 'standard', label: 'Standard', icon: Users, color: 'text-slate-400 bg-slate-500/20' }
];

// User Card Component
const UserCard = ({ user, onView, onEdit, onDelete, onReactivate }) => {
  const roleInfo = ROLE_OPTIONS.find(r => r.value === user.role) || ROLE_OPTIONS[2];
  const RoleIcon = roleInfo.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`glass-card rounded-xl p-5 border border-slate-800 hover:border-gold/50 transition-all ${!user.is_active ? 'opacity-60' : ''}`}
      data-testid={`user-card-${user.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center text-gold font-bold text-lg">
            {user.full_name[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-white">{user.full_name}</h3>
            <p className="text-slate-400 text-sm">{user.email}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${roleInfo.color}`}>
          <RoleIcon size={12} />
          {roleInfo.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Briefcase size={14} />
          <span>{user.applications_count} candidatures</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar size={14} />
          <span>{user.interviews_count} entretiens</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
        <span>Inscrit le {format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr })}</span>
        {user.last_login && (
          <span>Dernière connexion: {format(new Date(user.last_login), 'dd/MM/yy HH:mm')}</span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <div className="flex items-center gap-1">
          {user.is_active ? (
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <UserCheck size={14} /> Actif
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400 text-xs">
              <UserX size={14} /> Désactivé
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onView(user)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-gold"
            title="Voir détails"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => onEdit(user)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            title="Modifier"
          >
            <Edit2 size={16} />
          </button>
          {user.is_active ? (
            <button
              onClick={() => onDelete(user)}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-slate-400 hover:text-red-400"
              title="Désactiver"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <button
              onClick={() => onReactivate(user)}
              className="p-2 hover:bg-green-500/10 rounded-lg transition-colors text-slate-400 hover:text-green-400"
              title="Réactiver"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// User Detail Modal
const UserDetailModal = ({ user, isOpen, onClose, stats }) => {
  if (!user) return null;
  const roleInfo = ROLE_OPTIONS.find(r => r.value === user.role) || ROLE_OPTIONS[2];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-navy flex items-center justify-center text-gold font-bold text-xl">
              {user.full_name[0].toUpperCase()}
            </div>
            <div>
              <span className="text-white">{user.full_name}</span>
              <p className="text-slate-400 text-base font-normal">{user.email}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 mt-4 pr-2">
          {/* Status & Role */}
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
            {user.is_active ? (
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-500/20 text-green-400">
                Actif
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400">
                Désactivé
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">Candidatures</p>
              <p className="text-2xl font-bold text-white">{user.applications_count}</p>
            </div>
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">Entretiens</p>
              <p className="text-2xl font-bold text-white">{user.interviews_count}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">Date d'inscription</p>
              <p className="text-white">{format(new Date(user.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
            </div>
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-1">Dernière connexion</p>
              <p className="text-white">
                {user.last_login 
                  ? format(new Date(user.last_login), 'dd MMMM yyyy à HH:mm', { locale: fr })
                  : 'Jamais'
                }
              </p>
            </div>
          </div>

          {/* API Keys */}
          <div className="p-4 bg-slate-900/30 rounded-xl">
            <p className="text-slate-400 text-sm mb-2">Clés API configurées</p>
            <div className="flex gap-3">
              <span className={`px-2 py-1 rounded text-xs ${user.has_google_ai_key ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                Google AI: {user.has_google_ai_key ? '✓' : '✗'}
              </span>
              <span className={`px-2 py-1 rounded text-xs ${user.has_openai_key ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                OpenAI: {user.has_openai_key ? '✓' : '✗'}
              </span>
            </div>
          </div>

          {/* Applications by Status */}
          {stats?.applications_by_status && Object.keys(stats.applications_by_status).length > 0 && (
            <div className="p-4 bg-slate-900/30 rounded-xl">
              <p className="text-slate-400 text-sm mb-3">Candidatures par statut</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.applications_by_status).map(([status, count]) => (
                  <span key={status} className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300">
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Edit User Modal
const EditUserModal = ({ user, isOpen, onClose, onSave, loading }) => {
  const [role, setRole] = useState(user?.role || 'standard');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);

  useEffect(() => {
    if (user) {
      setRole(user.role || 'standard');
      setIsActive(user.is_active ?? true);
    }
  }, [user]);

  if (!user) return null;

  const handleSave = () => {
    onSave({
      role: role,
      is_active: isActive
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1a] border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Modifier l'utilisateur</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <p className="text-slate-400 text-sm mb-1">Utilisateur</p>
            <p className="text-white font-medium">{user.full_name}</p>
            <p className="text-slate-500 text-sm">{user.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Rôle</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {ROLE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Statut</label>
            <Select value={isActive ? 'active' : 'inactive'} onValueChange={(v) => setIsActive(v === 'active')}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="inactive">Désactivé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-700 text-slate-300"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-gold hover:bg-gold-light text-[#020817]"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function AdminUsersPage() {
  const { 
    users, 
    usersPagination, 
    fetchUsers, 
    fetchUserDetail,
    updateUser,
    deleteUser,
    reactivateUser,
    exportStats,
    loading 
  } = useAdmin();
  const { showConfirm, ConfirmDialog } = useConfirmDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingUserStats, setViewingUserStats] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = {};
    if (searchQuery) params.search = searchQuery;
    if (roleFilter !== 'all') params.role = roleFilter;
    if (statusFilter !== 'all') params.is_active = statusFilter === 'active';
    
    fetchUsers(params);
  }, [fetchUsers, searchQuery, roleFilter, statusFilter]);

  const handleViewUser = async (user) => {
    try {
      const detail = await fetchUserDetail(user.id);
      setViewingUser(detail.user);
      setViewingUserStats(detail.stats);
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleSaveUser = async (data) => {
    setSaving(true);
    try {
      await updateUser(editingUser.id, data);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmed = await showConfirm({
      title: 'Désactiver l\'utilisateur',
      message: `Êtes-vous sûr de vouloir désactiver le compte de ${user.full_name} ? L'utilisateur ne pourra plus se connecter.`,
      type: 'danger',
      confirmText: 'Désactiver',
      cancelText: 'Annuler',
    });

    if (confirmed) {
      await deleteUser(user.id);
      fetchUsers();
    }
  };

  const handleReactivateUser = async (user) => {
    const confirmed = await showConfirm({
      title: 'Réactiver l\'utilisateur',
      message: `Voulez-vous réactiver le compte de ${user.full_name} ?`,
      type: 'warning',
      confirmText: 'Réactiver',
      cancelText: 'Annuler',
    });

    if (confirmed) {
      await reactivateUser(user.id);
      fetchUsers();
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportStats();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin_stats_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur export:', err);
    }
  };

  const handlePageChange = (page) => {
    fetchUsers({ page, search: searchQuery });
  };

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">Gestion des Utilisateurs</h1>
          <p className="text-slate-400 mt-1">
            {usersPagination.total} utilisateur(s) au total
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" className="border-slate-700">
          <Download size={18} className="mr-2" />
          Exporter les stats
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="pl-10 bg-slate-900/50 border-slate-700 text-white"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px] bg-slate-900/50 border-slate-700 text-white">
            <SelectValue placeholder="Rôle" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">Tous les rôles</SelectItem>
            {ROLE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-slate-900/50 border-slate-700 text-white">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Désactivés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gold" size={32} />
        </div>
      ) : users.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
            <AnimatePresence>
              {users.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onView={handleViewUser}
                  onEdit={handleEditUser}
                  onDelete={handleDeleteUser}
                  onReactivate={handleReactivateUser}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {usersPagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(usersPagination.page - 1)}
                disabled={usersPagination.page <= 1}
                className="border-slate-700"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-slate-400 px-4">
                {usersPagination.page} / {usersPagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(usersPagination.page + 1)}
                disabled={usersPagination.page >= usersPagination.total_pages}
                className="border-slate-700"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-500">Aucun utilisateur trouvé</p>
        </div>
      )}

      {/* View User Modal */}
      <UserDetailModal
        user={viewingUser}
        stats={viewingUserStats}
        isOpen={!!viewingUser}
        onClose={() => { setViewingUser(null); setViewingUserStats(null); }}
      />

      {/* Edit User Modal */}
      <EditUserModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSave={handleSaveUser}
        loading={saving}
      />

      {/* Confirm Dialog */}
      {ConfirmDialog}
    </div>
  );
}
