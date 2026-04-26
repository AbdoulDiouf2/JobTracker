import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare, Clock, CheckCircle2, XCircle, AlertCircle,
  Trash2, ChevronDown, ChevronUp, Search, Filter, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminSupportTickets, useAdminSupportStats, useAdminSupportMutations } from '../../hooks/useAdmin';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';

const STATUS_CONFIG = {
  open:        { label: 'Ouvert',    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',    icon: AlertCircle },
  in_progress: { label: 'En cours',  color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
  resolved:    { label: 'Résolu',    color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle2 },
  closed:      { label: 'Fermé',     color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: XCircle },
};

const STATUSES = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, ...cfg }));

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 bg-slate-900/50 ${color}`}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-current/10">
        <Icon size={20} className="opacity-80" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function TicketRow({ ticket, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
  const StatusIcon = cfg.icon;
  const created = new Date(ticket.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <motion.div
      layout
      className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden"
    >
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
        data-testid={`ticket-row-${ticket.id}`}
      >
        <StatusIcon size={18} className={cfg.color.split(' ')[1]} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white truncate">{ticket.name}</span>
            <span className="text-slate-400 text-sm truncate">{ticket.email}</span>
          </div>
          <p className="text-slate-400 text-sm truncate mt-0.5">{ticket.message}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
          <span className="text-slate-500 text-xs hidden sm:block">{created}</span>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-slate-800 p-4 space-y-4"
        >
          <div>
            <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Message</p>
            <p className="text-slate-300 whitespace-pre-wrap text-sm">{ticket.message}</p>
          </div>

          {ticket.admin_note && (
            <div>
              <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Note admin</p>
              <p className="text-amber-300/80 text-sm whitespace-pre-wrap">{ticket.admin_note}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(ticket)}
              className="border-slate-700 text-slate-300 hover:text-white">
              Modifier / Répondre
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(ticket)}>
              <Trash2 size={14} className="mr-1" /> Supprimer
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function EditDialog({ ticket, open, onClose, onSave }) {
  const [status, setStatus] = useState(ticket?.status ?? 'open');
  const [note, setNote] = useState(ticket?.admin_note ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ status, admin_note: note });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f172a] border-slate-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Ticket de {ticket.name}</DialogTitle>
          <DialogDescription className="text-slate-400">{ticket.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Statut</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-all ${
                    status === s.value ? s.color : 'border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Note interne</label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note visible uniquement par les admins..."
              className="bg-slate-800 border-slate-700 text-white resize-none"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400">Annuler</Button>
          <Button onClick={handleSave} disabled={saving}
            className="bg-[#c4a052] hover:bg-[#b8934a] text-black font-medium">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ ticket, open, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f172a] border-slate-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle>Supprimer ce ticket ?</DialogTitle>
          <DialogDescription className="text-slate-400">
            Le ticket de <strong className="text-white">{ticket?.name}</strong> sera supprimé définitivement.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400">Annuler</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSupportPage() {
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingTicket, setEditingTicket] = useState(null);
  const [deletingTicket, setDeletingTicket] = useState(null);

  const queryParams = { page, per_page: 20, ...(filterStatus ? { status: filterStatus } : {}) };
  const { data, isLoading, refetch } = useAdminSupportTickets(queryParams);
  const { data: stats } = useAdminSupportStats();
  const { updateTicket, deleteTicket } = useAdminSupportMutations();

  const tickets = (data?.items ?? []).filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase()) ||
    t.message.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (updates) => {
    await updateTicket.mutateAsync({ ticketId: editingTicket.id, data: updates });
    toast.success('Ticket mis à jour');
  };

  const handleDelete = async () => {
    await deleteTicket.mutateAsync(deletingTicket.id);
    toast.success('Ticket supprimé');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white flex items-center gap-2">
            <MessageSquare size={24} className="text-red-400" />
            Support
          </h1>
          <p className="text-slate-400 text-sm mt-1">Gestion des tickets de support utilisateurs</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()}
          className="text-slate-400 hover:text-white">
          <RefreshCw size={16} className="mr-1" /> Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={AlertCircle} label="Ouverts"   value={stats?.open}        color="border-blue-500/20 text-blue-400" />
        <StatCard icon={Clock}       label="En cours"  value={stats?.in_progress}  color="border-amber-500/20 text-amber-400" />
        <StatCard icon={CheckCircle2} label="Résolus"  value={stats?.resolved}     color="border-green-500/20 text-green-400" />
        <StatCard icon={XCircle}     label="Fermés"    value={stats?.closed}       color="border-slate-500/20 text-slate-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher par nom, email ou message..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-[#c4a052]"
            data-testid="support-search"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setFilterStatus(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
              !filterStatus ? 'bg-slate-700 text-white border-slate-600' : 'border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            Tous ({stats?.total ?? 0})
          </button>
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => { setFilterStatus(s.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                filterStatus === s.value ? s.color : 'border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-900/60 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucun ticket trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onEdit={setEditingTicket}
              onDelete={setDeletingTicket}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="border-slate-700 text-slate-300">
            Précédent
          </Button>
          <span className="text-slate-400 text-sm">{page} / {data.total_pages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}
            className="border-slate-700 text-slate-300">
            Suivant
          </Button>
        </div>
      )}

      <EditDialog
        ticket={editingTicket}
        open={!!editingTicket}
        onClose={() => setEditingTicket(null)}
        onSave={handleSave}
      />
      <DeleteDialog
        ticket={deletingTicket}
        open={!!deletingTicket}
        onClose={() => setDeletingTicket(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
