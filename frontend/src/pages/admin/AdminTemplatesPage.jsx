import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Trash2, Edit2, Eye, Save, X, 
  Layout, Code, Sparkles, ChevronRight, Loader2,
  AlertCircle, CheckCircle2, Info
} from 'lucide-react';
import { useAdminTemplates, useAdminTemplateMutations } from '../../hooks/useAdmin';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { useConfirmDialog } from '../../components/ui/confirm-dialog';
import { toast } from 'sonner';

const AdminTemplatesPage = () => {
  const { data: templates = [], isLoading } = useAdminTemplates();
  const { createTemplate, updateTemplate, deleteTemplate } = useAdminTemplateMutations();
  const { confirm } = useConfirmDialog();

  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    html_content: '',
    is_active: true
  });

  const [previewData, setPreviewData] = useState({
    nom: 'Abdoul Ahad M. DIOUF',
    email: 'abdoul.diouf@maadec.com',
    entreprise: 'Orange Bank CI',
    poste: 'Senior Data Engineer',
    date: new Date().toLocaleDateString('fr-FR'),
    content: "C'est avec un grand enthousiasme que je vous adresse ma candidature pour le poste de Senior Data Engineer au sein d'Orange Bank CI.\n\nFort de mon expérience en ingénierie de données, j'ai développé une expertise solide dans l'architecture de pipelines robustes et l'optimisation des flux de données à grande échelle. Votre vision de la banque digitale correspond parfaitement à mes aspirations professionnelles."
  });

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      html_content: template.html_content,
      is_active: template.is_active
    });
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      html_content: `<!DOCTYPE html>
<html>
<head>
    <style>
        @page { size: A4; margin: 2cm; }
        body { font-family: 'Helvetica', Arial, sans-serif; color: #1a1a2e; line-height: 1.6; font-size: 11pt; }
        .header { border-bottom: 2px solid #c4a052; padding-bottom: 15pt; margin-bottom: 25pt; }
        .gold { color: #c4a052; }
        h1 { margin: 0; color: #c4a052; font-size: 24pt; }
        .content { text-align: justify; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ nom }}</h1>
        <p>{{ email }} | Candidature : <span class="gold">{{ poste }}</span></p>
    </div>
    <p style="text-align: right;">Le {{ date }}</p>
    <p>À l'attention du recrutement chez <strong>{{ entreprise }}</strong></p>
    
    <div class="content">
        {{ content }}
    </div>
    
    <p style="margin-top: 40pt;">Cordialement,<br><strong>{{ nom }}</strong></p>
</body>
</html>`,
      is_active: true
    });
    setIsEditing(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, data: formData });
        toast.success('Modèle mis à jour');
      } else {
        await createTemplate.mutateAsync(formData);
        toast.success('Modèle créé');
      }
      setIsEditing(false);
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Supprimer ce modèle ?',
      description: 'Cette action est irréversible et ce modèle ne sera plus disponible pour les utilisateurs.',
      confirmText: 'Supprimer',
      variant: 'destructive'
    });

    if (isConfirmed) {
      try {
        await deleteTemplate.mutateAsync(id);
        toast.success('Modèle supprimé');
      } catch (error) {
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  // Rendu de la preview HTML avec injection de variables (simple replacement pour la preview client)
  const getPreviewHTML = () => {
    let html = formData.html_content;
    const vars = {
      '{{ nom }}': previewData.nom,
      '{{ email }}': previewData.email,
      '{{ entreprise }}': previewData.entreprise,
      '{{ poste }}': previewData.poste,
      '{{ date }}': previewData.date,
      '{{ content }}': previewData.content
    };

    Object.entries(vars).forEach(([key, val]) => {
      html = html.replace(new RegExp(key, 'g'), val);
    });

    return html;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Layout className="text-gold" size={32} />
            Templates Premium
          </h1>
          <p className="text-slate-400 mt-1">Gérez les modèles de lettres de motivation haute fidélité</p>
        </div>
        <Button onClick={handleAddNew} className="bg-gold hover:bg-gold/80 text-navy font-semibold gap-2">
          <Plus size={20} />
          Nouveau Template
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Form Side */}
            <div className="glass-card rounded-2xl border border-slate-800 p-6 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  {editingTemplate ? <Edit2 size={20} /> : <Plus size={20} />}
                  {editingTemplate ? 'Modifier le modèle' : 'Créer un modèle'}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-slate-400">
                  <X size={20} />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Nom du modèle</label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Modern Professional Gold"
                    required
                    className="bg-[#0f172a] border-slate-700 text-white focus:ring-gold/20 focus:border-gold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Description</label>
                  <Input 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Brève description pour les utilisateurs"
                    className="bg-[#0f172a] border-slate-700 text-white focus:ring-gold/20 focus:border-gold"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Code size={16} className="text-gold" />
                      Code HTML / CSS
                    </label>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Moteur: xhtml2pdf (ReportLab)</span>
                  </div>
                  <Textarea 
                    value={formData.html_content}
                    onChange={(e) => setFormData({...formData, html_content: e.target.value})}
                    placeholder="Insérez votre code HTML ici..."
                    required
                    className="h-[400px] font-mono text-sm bg-[#0f172a] border-slate-700 text-white focus:border-gold/50 shadow-inner"
                  />
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3">
                    <Info className="text-blue-400 shrink-0" size={18} />
                    <p className="text-[11px] text-blue-200">
                      Utilisez <code className="text-blue-400">{"{{ nom }}"}</code>, <code className="text-blue-400">{"{{ entreprise }}"}</code>, <code className="text-blue-400">{"{{ poste }}"}</code>, <code className="text-blue-400">{"{{ date }}"}</code> et <code className="text-gold font-bold">{"{{ content }}"}</code> pour l'injection du corps de la lettre.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <Button type="submit" className="flex-1 bg-gold hover:bg-gold/80 text-navy font-bold gap-2">
                    {createTemplate.isPending || updateTemplate.isPending ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    Enregistrer le modèle
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="border-slate-700 text-slate-300">
                    Annuler
                  </Button>
                </div>
              </form>
            </div>

            {/* Preview Side */}
            <div className="flex flex-col gap-4">
              <div className="glass-card rounded-2xl border border-slate-800 p-6 flex-1 flex flex-col overflow-hidden h-[600px]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Eye size={20} className="text-gold" />
                    Prévisualisation
                  </h2>
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  </div>
                </div>

                <div className="bg-white rounded-lg flex-1 overflow-auto shadow-2xl">
                  {/* Iframe or Div for preview */}
                  <div 
                    dangerouslySetInnerHTML={{ __html: getPreviewHTML() }}
                    className="p-8 origin-top scale-[0.8] md:scale-90 lg:scale-100"
                  />
                </div>
              </div>

              {/* Preview Controls */}
              <div className="glass-card rounded-2xl border border-slate-800 p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase">Entreprise</label>
                    <Input 
                      value={previewData.entreprise}
                      onChange={(e) => setPreviewData({...previewData, entreprise: e.target.value})}
                      className="h-8 text-xs bg-[#0f172a] border-slate-800 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase">Poste</label>
                    <Input 
                      value={previewData.poste}
                      onChange={(e) => setPreviewData({...previewData, poste: e.target.value})}
                      className="h-8 text-xs bg-[#0f172a] border-slate-800 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase">Nom</label>
                    <Input 
                      value={previewData.nom}
                      onChange={(e) => setPreviewData({...previewData, nom: e.target.value})}
                      className="h-8 text-xs bg-[#0f172a] border-slate-800 text-white"
                    />
                  </div>
                  <div className="space-y-1 flex items-end">
                    <div className="p-2 bg-gold/10 rounded flex items-center gap-2 w-full text-gold text-[10px]">
                        <Sparkles size={12} />
                        Données de test
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase">Corps de la lettre ({"{{ content }}"})</label>
                  <Textarea 
                    value={previewData.content}
                    onChange={(e) => setPreviewData({...previewData, content: e.target.value})}
                    className="h-20 text-xs bg-[#0f172a] border-slate-800 text-white resize-none"
                    placeholder="Testez l'injection du corps de texte ici..."
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="glass-card rounded-2xl h-64 border border-slate-800 animate-pulse bg-slate-800/30" />
              ))
            ) : templates.length === 0 ? (
              <div className="col-span-full py-20 text-center glass-card rounded-2xl border border-dashed border-slate-800">
                <Layout size={48} className="text-slate-700 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white">Aucun template système</h3>
                <p className="text-slate-400 mt-2">Commencez par créer votre premier modèle premium.</p>
                <Button onClick={handleAddNew} className="mt-6 bg-gold hover:bg-gold/80 text-navy font-bold">
                  Créer un modèle
                </Button>
              </div>
            ) : (
              templates.map((template) => (
                <motion.div
                  key={template.id}
                  whileHover={{ y: -5 }}
                  className="glass-card rounded-2xl border border-slate-800 p-6 flex flex-col justify-between group hover:border-gold/30 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-gold/10 rounded-xl">
                        <FileText className="text-gold" size={24} />
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${template.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {template.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{template.name}</h3>
                    <p className="text-sm text-slate-400 line-clamp-2 mb-4">{template.description}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-slate-800 mt-auto">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEdit(template)}
                      className="flex-1 text-slate-300 hover:text-white hover:bg-white/5 gap-2"
                    >
                      <Edit2 size={16} />
                      Éditer
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(template.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTemplatesPage;
