import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Download, FileJson, FileSpreadsheet, FileText,
  CheckCircle, XCircle, AlertCircle, Loader2, Sparkles,
  FileUp, Award, Target, TrendingUp, Lightbulb, Briefcase,
  HelpCircle, Eye, ArrowRight, Table, Calendar
} from 'lucide-react';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Guide des colonnes pour candidatures
const COLUMN_GUIDE = {
  fr: {
    required: [
      { name: 'entreprise', description: 'Nom de l\'entreprise', example: 'Google' },
      { name: 'poste', description: 'Titre du poste', example: 'Développeur Full Stack' }
    ],
    optional: [
      { name: 'type_poste', description: 'Type de contrat', example: 'cdi, cdd, stage, alternance, freelance' },
      { name: 'lieu', description: 'Localisation', example: 'Paris, Remote' },
      { name: 'moyen', description: 'Source de candidature', example: 'linkedin, indeed, email' },
      { name: 'date_candidature', description: 'Date de candidature', example: '2025-01-15 ou 2025-01-15T10:00:00Z' },
      { name: 'lien', description: 'Lien vers l\'offre', example: 'https://...' },
      { name: 'commentaire', description: 'Notes personnelles', example: 'Contact: recruteur@...' },
      { name: 'reponse', description: 'Statut de la candidature', example: 'pending, positive, negative, no_response' }
    ]
  },
  en: {
    required: [
      { name: 'entreprise / company', description: 'Company name', example: 'Google' },
      { name: 'poste / position', description: 'Job title', example: 'Full Stack Developer' }
    ],
    optional: [
      { name: 'type_poste / type', description: 'Contract type', example: 'cdi, cdd, stage, alternance, freelance' },
      { name: 'lieu / location', description: 'Location', example: 'Paris, Remote' },
      { name: 'moyen / source', description: 'Application source', example: 'linkedin, indeed, email' },
      { name: 'date_candidature / date', description: 'Application date', example: '2025-01-15 or 2025-01-15T10:00:00Z' },
      { name: 'lien / link', description: 'Job link', example: 'https://...' },
      { name: 'commentaire / comment', description: 'Personal notes', example: 'Contact: recruiter@...' },
      { name: 'reponse / status', description: 'Application status', example: 'pending, positive, negative, no_response' }
    ]
  }
};

// Guide des colonnes pour entretiens
const INTERVIEW_COLUMN_GUIDE = {
  fr: {
    required: [
      { name: 'entreprise', description: 'Nom de l\'entreprise (doit correspondre à une candidature existante)', example: 'Google' },
      { name: 'date_entretien', description: 'Date et heure de l\'entretien', example: '2025-01-20T14:00:00' }
    ],
    optional: [
      { name: 'type_entretien', description: 'Type d\'entretien', example: 'technical, hr, manager, final' },
      { name: 'format_entretien', description: 'Format', example: 'video, phone, onsite' },
      { name: 'lieu_lien', description: 'Lieu ou lien visio', example: 'https://meet.google.com/...' },
      { name: 'interviewer', description: 'Nom du recruteur', example: 'Marie Dupont' },
      { name: 'statut', description: 'Statut de l\'entretien', example: 'planned, completed, cancelled' },
      { name: 'commentaire', description: 'Notes', example: 'Préparer questions techniques' }
    ]
  },
  en: {
    required: [
      { name: 'entreprise / company', description: 'Company name (must match existing application)', example: 'Google' },
      { name: 'date_entretien / date', description: 'Interview date and time', example: '2025-01-20T14:00:00' }
    ],
    optional: [
      { name: 'type_entretien / type', description: 'Interview type', example: 'technical, hr, manager, final' },
      { name: 'format_entretien / format', description: 'Format', example: 'video, phone, onsite' },
      { name: 'lieu_lien / location', description: 'Location or video link', example: 'https://meet.google.com/...' },
      { name: 'interviewer', description: 'Recruiter name', example: 'Marie Dupont' },
      { name: 'statut / status', description: 'Interview status', example: 'planned, completed, cancelled' },
      { name: 'commentaire / comment', description: 'Notes', example: 'Prepare technical questions' }
    ]
  }
};

export default function ImportExportPage() {
  const { language } = useLanguage();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cvAnalysis, setCvAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState('import');
  const [importType, setImportType] = useState('applications'); // 'applications' or 'interviews'
  const [exportType, setExportType] = useState('applications'); // 'applications' or 'interviews'
  const [showGuide, setShowGuide] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [fullData, setFullData] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);
  const cvInputRef = useRef(null);

  const t = {
    fr: {
      title: 'Import / Export',
      subtitle: 'Gérez vos données et analysez votre CV',
      importTab: 'Importer',
      exportTab: 'Exporter',
      cvTab: 'Analyse CV',
      importTitle: 'Importer des données',
      importDesc: 'Importez vos candidatures ou entretiens depuis un fichier',
      importApplications: 'Candidatures',
      importInterviews: 'Entretiens',
      selectFile: 'Sélectionner un fichier',
      supportedFormats: 'Formats supportés: JSON, CSV, Excel',
      importing: 'Import en cours...',
      importSuccess: 'Import réussi !',
      imported: 'éléments importés',
      importedApplications: 'candidatures importées',
      importedInterviews: 'entretiens importés',
      skipped: 'ignorés',
      errors: 'Erreurs',
      exportTitle: 'Exporter vos données',
      exportDesc: 'Téléchargez vos candidatures ou entretiens',
      exportApplications: 'Candidatures',
      exportInterviews: 'Entretiens',
      exportJson: 'Exporter JSON',
      exportExcel: 'Exporter Excel',
      exportCsv: 'Exporter CSV',
      cvTitle: 'Analyse de CV',
      cvDesc: 'Uploadez votre CV pour une analyse IA complète',
      uploadCv: 'Uploader votre CV',
      cvFormats: 'Formats: PDF, DOCX, TXT',
      analyzing: 'Analyse en cours...',
      score: 'Score global',
      summary: 'Résumé',
      skills: 'Compétences détectées',
      strengths: 'Points forts',
      improvements: 'Améliorations suggérées',
      matchingJobs: 'Postes recommandés',
      recommendations: 'Recommandations',
      experience: 'Années d\'expérience',
      guideTitle: 'Guide des colonnes',
      guideDesc: 'Structure attendue pour l\'import',
      requiredColumns: 'Colonnes obligatoires',
      optionalColumns: 'Colonnes optionnelles',
      column: 'Colonne',
      description: 'Description',
      example: 'Exemple',
      jsonExample: 'Exemple JSON',
      csvExample: 'Exemple CSV',
      preview: 'Prévisualisation',
      previewDesc: 'Vérifiez les données avant l\'import',
      confirmImport: 'Confirmer l\'import',
      cancelImport: 'Annuler',
      rowsToImport: 'lignes à importer',
      showGuide: 'Voir le guide'
    },
    en: {
      title: 'Import / Export',
      subtitle: 'Manage your data and analyze your CV',
      importTab: 'Import',
      exportTab: 'Export',
      cvTab: 'CV Analysis',
      importTitle: 'Import data',
      importDesc: 'Import your applications or interviews from a file',
      importApplications: 'Applications',
      importInterviews: 'Interviews',
      selectFile: 'Select a file',
      supportedFormats: 'Supported formats: JSON, CSV, Excel',
      importing: 'Importing...',
      importSuccess: 'Import successful!',
      imported: 'items imported',
      importedApplications: 'applications imported',
      importedInterviews: 'interviews imported',
      skipped: 'skipped',
      errors: 'Errors',
      exportTitle: 'Export your data',
      exportDesc: 'Download your applications or interviews',
      exportApplications: 'Applications',
      exportInterviews: 'Interviews',
      exportJson: 'Export JSON',
      exportExcel: 'Export Excel',
      exportCsv: 'Export CSV',
      cvTitle: 'CV Analysis',
      cvDesc: 'Upload your CV for a complete AI analysis',
      uploadCv: 'Upload your CV',
      cvFormats: 'Formats: PDF, DOCX, TXT',
      analyzing: 'Analyzing...',
      score: 'Overall score',
      summary: 'Summary',
      skills: 'Detected skills',
      strengths: 'Strengths',
      improvements: 'Suggested improvements',
      matchingJobs: 'Recommended jobs',
      recommendations: 'Recommendations',
      experience: 'Years of experience',
      guideTitle: 'Column guide',
      guideDesc: 'Expected structure for import',
      requiredColumns: 'Required columns',
      optionalColumns: 'Optional columns',
      column: 'Column',
      description: 'Description',
      example: 'Example',
      jsonExample: 'JSON Example',
      csvExample: 'CSV Example',
      preview: 'Preview',
      previewDesc: 'Check data before import',
      confirmImport: 'Confirm import',
      cancelImport: 'Cancel',
      rowsToImport: 'rows to import',
      showGuide: 'Show guide'
    }
  }[language];

  const guide = importType === 'applications' ? COLUMN_GUIDE[language] : INTERVIEW_COLUMN_GUIDE[language];

  const mapRowToApplication = (row) => {
    const mapped = {};
    const interviews = [];

    Object.entries(row).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Map known columns
      if (lowerKey === 'entreprise' || lowerKey === 'company') {
        mapped.entreprise = value;
      } else if (lowerKey === 'poste' || lowerKey === 'position' || lowerKey === 'job') {
        mapped.poste = value;
      } else if (lowerKey === 'type' || lowerKey === 'type_poste' || lowerKey === 'contrat') {
        mapped.type_poste = value;
      } else if (lowerKey === 'lieu' || lowerKey === 'location' || lowerKey === 'ville') {
        mapped.lieu = value;
      } else if (lowerKey === 'moyen' || lowerKey === 'source') {
        mapped.moyen = value;
      } else if (lowerKey.includes('date') && (lowerKey.includes('postule') || lowerKey.includes('candidature'))) {
        // Handle Date object, number (serial), or string
        if (value instanceof Date) {
          mapped.date_candidature = value.toISOString();
        } else if (typeof value === 'number') {
          // Check if it's an Excel serial date (usually < 100000) or timestamp
          if (value < 100000) {
            const date = XLSX.SSF.parse_date_code(value);
            mapped.date_candidature = new Date(date.y, date.m - 1, date.d, date.H, date.M, date.S).toISOString();
          } else {
            mapped.date_candidature = new Date(value).toISOString();
          }
        } else {
          mapped.date_candidature = value;
        }
      } else if (lowerKey === 'lien' || lowerKey === 'link' || lowerKey === 'url') {
        mapped.lien = value;
      } else if (lowerKey === 'commentaire' || lowerKey === 'comment' || lowerKey === 'notes') {
        mapped.commentaire = value;
      } else if (lowerKey === 'reponse' || lowerKey === 'response' || lowerKey === 'status' || lowerKey === 'statut') {
        // Map response status
        const valStr = String(value || '').toLowerCase();
        if (valStr.includes('rejet') || valStr.includes('refus') || valStr.includes('❌')) {
          mapped.reponse = 'negative';
        } else if (valStr.includes('accept') || valStr.includes('✅') || valStr.includes('positiv')) {
          mapped.reponse = 'positive';
        } else if (valStr.includes('attente') || valStr.includes('pending') || valStr.includes('⏳')) {
          mapped.reponse = 'pending';
        } else if (valStr.includes('no_response') || valStr.includes('sans reponse')) {
          mapped.reponse = 'no_response';
        } else {
          mapped.reponse = 'pending';
        }
      }
    });

    // Extract potential interviews (Entretien 1, Entretien 2, etc.)
    for (let i = 1; i <= 5; i++) {
        // Find keys that match "Date Entretien i" pattern loosely
        const findKey = (pattern) => Object.keys(row).find(k => 
            k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(pattern.toLowerCase()) && 
            k.includes(i.toString())
        );

        const dateKey = findKey('date entretien') || findKey('date_entretien');
        
        if (dateKey && row[dateKey]) {
            const typeKey = findKey('type entretien') || findKey('type_entretien') || findKey('type');
            const formatKey = findKey('format entretien') || findKey('format_entretien') || findKey('format');
            const lieuKey = findKey('lieu/lien') || findKey('lieu entretien') || findKey('lieu');
            const interviewerKey = findKey('interviewer') || findKey('interviewer');
            const statusKey = findKey('statut entretien') || findKey('statut');
            const commentKey = findKey('commentaire entretien') || findKey('commentaire');

            let dateVal = row[dateKey];
            if (dateVal instanceof Date) {
                dateVal = dateVal.toISOString();
            } else if (typeof dateVal === 'number') {
                try {
                  if (dateVal < 100000) {
                    const d = XLSX.SSF.parse_date_code(dateVal);
                    dateVal = new Date(d.y, d.m - 1, d.d, d.H, d.M, d.S).toISOString();
                  } else {
                    dateVal = new Date(dateVal).toISOString();
                  }
                } catch (e) { console.error('Date parsing error', e); }
            }

            let status = 'planned';
            if (row[statusKey]) {
                const s = String(row[statusKey]).toLowerCase();
                if (s.includes('réalisé') || s.includes('realise') || s.includes('completed') || s.includes('✅')) status = 'completed';
                else if (s.includes('annulé') || s.includes('annule') || s.includes('cancelled') || s.includes('❌')) status = 'cancelled';
            }

            interviews.push({
                date_entretien: dateVal,
                type_entretien: row[typeKey] || 'technical',
                format_entretien: row[formatKey] || 'video',
                lieu_lien: row[lieuKey] || '',
                interviewer: row[interviewerKey] || '',
                statut: status,
                commentaire: row[commentKey] || ''
            });
        }
    }

    if (interviews.length > 0) {
        mapped.interviews = interviews;
    }

    return mapped;
  };

  // Helper function to map columns for interviews
  const mapRowToInterview = (row) => {
    const mapped = {};
    Object.entries(row).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      if (lowerKey === 'entreprise' || lowerKey === 'company') {
        mapped.entreprise = value;
      } else if (lowerKey === 'poste' || lowerKey === 'position') {
        mapped.poste = value;
      } else if (lowerKey === 'candidature_id') {
        mapped.candidature_id = value;
      } else if (lowerKey.includes('date') && lowerKey.includes('entretien')) {
        if (value instanceof Date) {
          mapped.date_entretien = value.toISOString();
        } else if (typeof value === 'number') {
          try {
            if (value < 100000) {
              const d = XLSX.SSF.parse_date_code(value);
              mapped.date_entretien = new Date(d.y, d.m - 1, d.d, d.H, d.M, d.S).toISOString();
            } else {
              mapped.date_entretien = new Date(value).toISOString();
            }
          } catch (e) { mapped.date_entretien = value; }
        } else {
          mapped.date_entretien = value;
        }
      } else if (lowerKey === 'type_entretien' || lowerKey === 'type entretien' || lowerKey === 'type') {
        mapped.type_entretien = value;
      } else if (lowerKey === 'format_entretien' || lowerKey === 'format entretien' || lowerKey === 'format') {
        mapped.format_entretien = value;
      } else if (lowerKey === 'lieu_entretien' || lowerKey === 'lieu_lien' || lowerKey.includes('lieu') || lowerKey.includes('lien') || lowerKey.includes('link')) {
        mapped.lieu_lien = value;
      } else if (lowerKey === 'interviewer' || lowerKey === 'recruteur') {
        mapped.interviewer = value;
      } else if (lowerKey === 'statut' || lowerKey === 'status') {
        const valStr = String(value || '').toLowerCase();
        if (valStr.includes('realis') || valStr.includes('complet') || valStr.includes('✅')) {
          mapped.statut = 'completed';
        } else if (valStr.includes('annul') || valStr.includes('cancel') || valStr.includes('❌')) {
          mapped.statut = 'cancelled';
        } else if (valStr.includes('planifi') || valStr.includes('planned') || valStr.includes('📅')) {
          mapped.statut = 'planned';
        } else {
          mapped.statut = 'planned';
        }
      } else if (lowerKey === 'commentaire' || lowerKey === 'comment' || lowerKey === 'notes') {
        mapped.commentaire = value;
      }
    });
    return mapped;
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewFile(file);
    setImportResult(null);
    setPreviewData(null);
    setFullData(null);

    const mapRow = importType === 'applications' ? mapRowToApplication : mapRowToInterview;
    const filterFn = importType === 'applications' 
      ? (obj) => obj.entreprise || obj.poste
      : (obj) => obj.entreprise || obj.date_entretien;

    try {
      let data = [];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.json')) {
        const content = await file.text();
        // Try standard JSON first
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            data = parsed;
          } else if (parsed.applications) {
            data = parsed.applications;
          } else if (parsed.interviews) {
            data = parsed.interviews;
          } else if (parsed.candidatures) {
            data = parsed.candidatures;
          } else if (parsed.entretiens) {
            data = parsed.entretiens;
          } else if (typeof parsed === 'object') {
            data = [parsed];
          }
        } catch {
          // Try NDJSON format (one JSON object per line)
          const lines = content.split('\n').filter(l => l.trim());
          data = lines.map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          }).filter(obj => obj !== null);
        }
        
        // Map column names
        data = data.map(mapRow).filter(filterFn);
        
      } else if (fileName.endsWith('.csv')) {
        const content = await file.text();
        const lines = content.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          data = lines.slice(1).map(line => {
            const values = line.match(/("([^"]*)"|[^,]*)/g) || [];
            const obj = {};
            headers.forEach((h, i) => {
              let val = values[i]?.trim() || '';
              val = val.replace(/^"|"$/g, '');
              obj[h] = val;
            });
            return obj;
          });
          // Map column names
          data = data.map(mapRow).filter(filterFn);
        }
        
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '', cellDates: true });
        
        // Map column names
        data = rawData.map(mapRow).filter(filterFn);
      }

      console.log('Parsed data:', data);
      
      if (data && data.length > 0) {
        setFullData(data); // Store ALL data for import
        setPreviewData(data.slice(0, 10)); // Only preview first 10
      } else {
        setFullData(null);
        setPreviewData([]);
        setImportResult({
          success: false,
          imported_count: 0,
          errors: ['Aucune donnée trouvée dans le fichier. Vérifiez le format.'],
          skipped: 0
        });
      }
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewData(null);
      setFullData(null);
      setImportResult({
        success: false,
        imported_count: 0,
        errors: [`Erreur de lecture: ${error.message}`],
        skipped: 0
      });
    }
  };

  const handleConfirmImport = async () => {
    if (!fullData || fullData.length === 0) return;

    setImporting(true);

    try {
      const token = localStorage.getItem('token');
      
      // Use different endpoint based on import type
      const endpoint = importType === 'applications' 
        ? `${API_URL}/api/import/data`
        : `${API_URL}/api/import/interviews/data`;
      
      const payload = importType === 'applications' 
        ? { applications: fullData }
        : { interviews: fullData };
      
      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setImportResult(response.data);
      setPreviewData(null);
      setFullData(null);
      setPreviewFile(null);
    } catch (error) {
      setImportResult({
        success: false,
        imported_count: 0,
        errors: [error.response?.data?.detail || 'Erreur lors de l\'import'],
        skipped: 0
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setFullData(null);
    setPreviewFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = async (format) => {
    try {
      const token = localStorage.getItem('token');
      
      // Build endpoint based on export type
      const endpoint = exportType === 'applications' 
        ? `${API_URL}/api/export/${format}`
        : `${API_URL}/api/export/interviews/${format}`;
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: format === 'json' ? 'json' : 'blob'
      });

      const prefix = exportType === 'applications' ? 'candidatures' : 'entretiens';
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `${prefix}_${new Date().toISOString().split('T')[0]}.json`);
      } else {
        const ext = format === 'excel' ? 'xlsx' : 'csv';
        downloadBlob(response.data, `${prefix}_${new Date().toISOString().split('T')[0]}.${ext}`);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setCvAnalysis(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/api/import/analyze-cv`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setCvAnalysis(response.data);
    } catch (error) {
      console.error('CV Analysis error:', error);
      setCvAnalysis({
        score: 0,
        summary: error.response?.data?.detail || 'Erreur lors de l\'analyse',
        skills: [],
        strengths: [],
        improvements: [],
        matching_jobs: [],
        recommendations: ''
      });
    } finally {
      setAnalyzing(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6" data-testid="import-export-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-white">{t.title}</h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
              ${activeTab === 'import' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
          >
            <Upload size={16} />
            {t.importTab}
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
              ${activeTab === 'export' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
          >
            <Download size={16} />
            {t.exportTab}
          </button>
          <button
            onClick={() => setActiveTab('cv')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
              ${activeTab === 'cv' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
          >
            <Sparkles size={16} />
            {t.cvTab}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Import Tab */}
        {activeTab === 'import' && (
          <motion.div
            key="import"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Import Type Selector */}
            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-sm">{language === 'fr' ? 'Type de données :' : 'Data type:'}</span>
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
                <button
                  onClick={() => { setImportType('applications'); setPreviewData(null); setFullData(null); setImportResult(null); }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
                    ${importType === 'applications' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
                >
                  <Briefcase size={16} />
                  {t.importApplications}
                </button>
                <button
                  onClick={() => { setImportType('interviews'); setPreviewData(null); setFullData(null); setImportResult(null); }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
                    ${importType === 'interviews' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
                >
                  <Calendar size={16} />
                  {t.importInterviews}
                </button>
              </div>
            </div>

            {/* Guide Section */}
            <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="text-gold" size={20} />
                  <span className="text-white font-medium">{t.guideTitle}</span>
                  <span className="text-slate-500 text-sm">- {t.guideDesc}</span>
                </div>
                <motion.div
                  animate={{ rotate: showGuide ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ArrowRight size={20} className="text-slate-400" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showGuide && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-800"
                  >
                    <div className="p-6 space-y-6">
                      {/* Required Columns */}
                      <div>
                        <h4 className="text-green-400 font-medium mb-3 flex items-center gap-2">
                          <CheckCircle size={16} />
                          {t.requiredColumns}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="text-left py-2 px-3 text-slate-400">{t.column}</th>
                                <th className="text-left py-2 px-3 text-slate-400">{t.description}</th>
                                <th className="text-left py-2 px-3 text-slate-400">{t.example}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {guide.required.map((col, i) => (
                                <tr key={i} className="border-b border-slate-800">
                                  <td className="py-2 px-3 text-gold font-mono">{col.name}</td>
                                  <td className="py-2 px-3 text-slate-300">{col.description}</td>
                                  <td className="py-2 px-3 text-slate-500">{col.example}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Optional Columns */}
                      <div>
                        <h4 className="text-blue-400 font-medium mb-3 flex items-center gap-2">
                          <AlertCircle size={16} />
                          {t.optionalColumns}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="text-left py-2 px-3 text-slate-400">{t.column}</th>
                                <th className="text-left py-2 px-3 text-slate-400">{t.description}</th>
                                <th className="text-left py-2 px-3 text-slate-400">{t.example}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {guide.optional.map((col, i) => (
                                <tr key={i} className="border-b border-slate-800">
                                  <td className="py-2 px-3 text-slate-300 font-mono">{col.name}</td>
                                  <td className="py-2 px-3 text-slate-300">{col.description}</td>
                                  <td className="py-2 px-3 text-slate-500">{col.example}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Examples */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-slate-300 font-medium mb-2">{t.jsonExample}</h4>
                          <pre className="bg-slate-900 rounded-lg p-4 text-xs text-slate-400 overflow-x-auto">
{`{
  "applications": [
    {
      "entreprise": "Google",
      "poste": "Software Engineer",
      "type_poste": "cdi",
      "lieu": "Paris"
    }
  ]
}`}
                          </pre>
                        </div>
                        <div>
                          <h4 className="text-slate-300 font-medium mb-2">{t.csvExample}</h4>
                          <pre className="bg-slate-900 rounded-lg p-4 text-xs text-slate-400 overflow-x-auto">
{`entreprise,poste,type_poste,lieu
Google,Software Engineer,cdi,Paris
Meta,Frontend Developer,cdi,Londres`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Upload Section */}
            <div className="glass-card rounded-xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Upload className="text-blue-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{t.importTitle}</h2>
                  <p className="text-slate-400 text-sm">{t.importDesc}</p>
                </div>
              </div>

              {/* Preview Section */}
              {previewData && previewData.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-gold">
                    <Eye size={20} />
                    <h3 className="font-medium">{t.preview}</h3>
                    <span className="text-slate-400 text-sm">
                      ({fullData?.length || 0} {t.rowsToImport}{previewData.length < (fullData?.length || 0) ? ` - ${language === 'fr' ? 'aperçu des 10 premières' : 'showing first 10'}` : ''})
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto border border-slate-700 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800/50">
                          {Object.keys(previewData[0]).slice(0, 6).map((key) => (
                            <th key={key} className="text-left py-2 px-3 text-slate-400 font-medium">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t border-slate-800">
                            {Object.values(row).slice(0, 6).map((val, j) => (
                              <td key={j} className="py-2 px-3 text-slate-300 truncate max-w-[150px]">
                                {String(val || '-')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleCancelPreview}
                      variant="outline"
                      className="border-slate-700 text-slate-300"
                    >
                      <XCircle size={18} className="mr-2" />
                      {t.cancelImport}
                    </Button>
                    <Button
                      onClick={handleConfirmImport}
                      disabled={importing}
                      className="bg-gold hover:bg-gold-light text-[#020817]"
                    >
                      {importing ? (
                        <Loader2 className="animate-spin mr-2" size={18} />
                      ) : (
                        <CheckCircle size={18} className="mr-2" />
                      )}
                      {t.confirmImport}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-gold/50 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="import-file"
                  />
                  <label htmlFor="import-file" className="cursor-pointer">
                    <FileUp size={48} className="mx-auto text-slate-500 mb-4" />
                    <p className="text-white font-medium mb-2">{t.selectFile}</p>
                    <p className="text-slate-500 text-sm">JSON, CSV, Excel (.xlsx, .xls)</p>
                  </label>
                </div>
              )}

              {importing && (
                <div className="mt-4 flex items-center gap-3 text-gold">
                  <Loader2 className="animate-spin" size={20} />
                  <span>{t.importing}</span>
                </div>
              )}

              {importResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 p-4 rounded-xl ${importResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {importResult.success ? (
                      <CheckCircle className="text-green-400" size={20} />
                    ) : (
                      <XCircle className="text-red-400" size={20} />
                    )}
                    <span className={importResult.success ? 'text-green-400' : 'text-red-400'}>
                      {importResult.success ? t.importSuccess : 'Erreur'}
                    </span>
                  </div>
                  <p className="text-white">
                    <span className="text-2xl font-bold">{importResult.imported_count}</span> {t.imported}
                    {importResult.skipped > 0 && (
                      <span className="text-slate-400 ml-2">({importResult.skipped} {t.skipped})</span>
                    )}
                  </p>
                  {importResult.errors?.length > 0 && (
                    <div className="mt-2 text-sm text-red-400">
                      <p className="font-medium">{t.errors}:</p>
                      {importResult.errors.slice(0, 3).map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <motion.div
            key="export"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card rounded-xl border border-slate-800 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Download className="text-green-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{t.exportTitle}</h2>
                <p className="text-slate-400 text-sm">{t.exportDesc}</p>
              </div>
            </div>

            {/* Export Type Selector */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-slate-400 text-sm">{language === 'fr' ? 'Type de données :' : 'Data type:'}</span>
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
                <button
                  onClick={() => setExportType('applications')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
                    ${exportType === 'applications' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
                >
                  <Briefcase size={16} />
                  {t.exportApplications}
                </button>
                <button
                  onClick={() => setExportType('interviews')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
                    ${exportType === 'interviews' ? 'bg-gold text-[#020817]' : 'text-slate-400 hover:text-white'}`}
                >
                  <Calendar size={16} />
                  {t.exportInterviews}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <button
                onClick={() => handleExport('json')}
                className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-gold/50 transition-all group"
              >
                <FileJson size={32} className="text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-white font-medium">{t.exportJson}</h3>
                <p className="text-slate-500 text-sm mt-1">Données structurées</p>
              </button>
              
              <button
                onClick={() => handleExport('excel')}
                className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-gold/50 transition-all group"
              >
                <FileSpreadsheet size={32} className="text-green-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-white font-medium">{t.exportExcel}</h3>
                <p className="text-slate-500 text-sm mt-1">Format tableur</p>
              </button>
              
              <button
                onClick={() => handleExport('csv')}
                className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-gold/50 transition-all group"
              >
                <FileText size={32} className="text-yellow-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-white font-medium">{t.exportCsv}</h3>
                <p className="text-slate-500 text-sm mt-1">Compatible tous logiciels</p>
              </button>
            </div>
          </motion.div>
        )}

        {/* CV Analysis Tab */}
        {activeTab === 'cv' && (
          <motion.div
            key="cv"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Upload Section */}
            <div className="glass-card rounded-xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center">
                  <Sparkles className="text-gold" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{t.cvTitle}</h2>
                  <p className="text-slate-400 text-sm">{t.cvDesc}</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-gold/50 transition-colors">
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={handleCVUpload}
                  className="hidden"
                  id="cv-file"
                />
                <label htmlFor="cv-file" className="cursor-pointer">
                  <FileUp size={48} className="mx-auto text-gold/50 mb-4" />
                  <p className="text-white font-medium mb-2">{t.uploadCv}</p>
                  <p className="text-slate-500 text-sm">{t.cvFormats}</p>
                </label>
              </div>

              {analyzing && (
                <div className="mt-4 flex items-center justify-center gap-3 text-gold py-8">
                  <Loader2 className="animate-spin" size={24} />
                  <span className="text-lg">{t.analyzing}</span>
                </div>
              )}
            </div>

            {/* Analysis Results */}
            {cvAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Score Card */}
                <div className="glass-card rounded-xl border border-slate-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Award className="text-gold" size={28} />
                      <h3 className="text-xl font-semibold text-white">{t.score}</h3>
                    </div>
                    <div className={`text-5xl font-bold ${getScoreColor(cvAnalysis.score)}`}>
                      {cvAnalysis.score}
                      <span className="text-2xl text-slate-500">/100</span>
                    </div>
                  </div>
                  <Progress value={cvAnalysis.score} className="h-3" />
                  {cvAnalysis.experience_years && (
                    <p className="text-slate-400 mt-4">
                      {t.experience}: <span className="text-white font-medium">{cvAnalysis.experience_years} ans</span>
                    </p>
                  )}
                </div>

                {/* Summary */}
                {cvAnalysis.summary && (
                  <div className="glass-card rounded-xl border border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Target className="text-blue-400" size={20} />
                      {t.summary}
                    </h3>
                    <p className="text-slate-300 leading-relaxed">{cvAnalysis.summary}</p>
                  </div>
                )}

                {/* Skills */}
                {cvAnalysis.skills?.length > 0 && (
                  <div className="glass-card rounded-xl border border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <TrendingUp className="text-green-400" size={20} />
                      {t.skills}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {cvAnalysis.skills.map((skill, i) => (
                        <span key={i} className="px-3 py-1.5 bg-slate-800 rounded-full text-sm text-slate-300">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & Improvements */}
                <div className="grid md:grid-cols-2 gap-6">
                  {cvAnalysis.strengths?.length > 0 && (
                    <div className="glass-card rounded-xl border border-green-500/30 p-6">
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <CheckCircle size={20} />
                        {t.strengths}
                      </h3>
                      <ul className="space-y-2">
                        {cvAnalysis.strengths.map((item, i) => (
                          <li key={i} className="text-slate-300 flex items-start gap-2">
                            <span className="text-green-400 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {cvAnalysis.improvements?.length > 0 && (
                    <div className="glass-card rounded-xl border border-yellow-500/30 p-6">
                      <h3 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                        <AlertCircle size={20} />
                        {t.improvements}
                      </h3>
                      <ul className="space-y-2">
                        {cvAnalysis.improvements.map((item, i) => (
                          <li key={i} className="text-slate-300 flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Matching Jobs */}
                {cvAnalysis.matching_jobs?.length > 0 && (
                  <div className="glass-card rounded-xl border border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Briefcase className="text-gold" size={20} />
                      {t.matchingJobs}
                    </h3>
                    <div className="space-y-3">
                      {cvAnalysis.matching_jobs.map((job, i) => (
                        <div key={i} className="p-4 bg-slate-800/50 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-white font-medium">{job.title}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              job.match_score >= 80 ? 'bg-green-500/20 text-green-400' :
                              job.match_score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {job.match_score}% match
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm">{job.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {cvAnalysis.recommendations && (
                  <div className="glass-card rounded-xl border border-gold/30 p-6">
                    <h3 className="text-lg font-semibold text-gold mb-3 flex items-center gap-2">
                      <Lightbulb size={20} />
                      {t.recommendations}
                    </h3>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{cvAnalysis.recommendations}</p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
