import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Download, FileJson, FileSpreadsheet, FileText,
  CheckCircle, XCircle, AlertCircle, Loader2, Sparkles,
  FileUp, Award, Target, TrendingUp, Lightbulb, Briefcase
} from 'lucide-react';
import { useLanguage } from '../i18n';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ImportExportPage() {
  const { language } = useLanguage();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cvAnalysis, setCvAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState('import'); // 'import', 'export', 'cv'
  const fileInputRef = useRef(null);
  const cvInputRef = useRef(null);

  const t = {
    fr: {
      title: 'Import / Export',
      subtitle: 'Gérez vos données et analysez votre CV',
      importTab: 'Importer',
      exportTab: 'Exporter',
      cvTab: 'Analyse CV',
      importTitle: 'Importer des candidatures',
      importDesc: 'Importez vos candidatures depuis un fichier JSON ou CSV',
      selectFile: 'Sélectionner un fichier',
      supportedFormats: 'Formats supportés: JSON, CSV',
      importing: 'Import en cours...',
      importSuccess: 'Import réussi !',
      imported: 'candidatures importées',
      skipped: 'ignorées',
      errors: 'Erreurs',
      exportTitle: 'Exporter vos données',
      exportDesc: 'Téléchargez toutes vos candidatures et entretiens',
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
      experience: 'Années d\'expérience'
    },
    en: {
      title: 'Import / Export',
      subtitle: 'Manage your data and analyze your CV',
      importTab: 'Import',
      exportTab: 'Export',
      cvTab: 'CV Analysis',
      importTitle: 'Import applications',
      importDesc: 'Import your applications from a JSON or CSV file',
      selectFile: 'Select a file',
      supportedFormats: 'Supported formats: JSON, CSV',
      importing: 'Importing...',
      importSuccess: 'Import successful!',
      imported: 'applications imported',
      skipped: 'skipped',
      errors: 'Errors',
      exportTitle: 'Export your data',
      exportDesc: 'Download all your applications and interviews',
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
      experience: 'Years of experience'
    }
  }[language];

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = file.name.endsWith('.json') ? '/api/import/json' : '/api/import/csv';
      const response = await axios.post(`${API_URL}${endpoint}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResult(response.data);
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

  const handleExport = async (format) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: format === 'json' ? 'json' : 'blob'
      });

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `jobtracker_export_${new Date().toISOString().split('T')[0]}.json`);
      } else {
        const ext = format === 'excel' ? 'xlsx' : 'csv';
        downloadBlob(response.data, `jobtracker_export_${new Date().toISOString().split('T')[0]}.${ext}`);
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
            className="glass-card rounded-xl border border-slate-800 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Upload className="text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{t.importTitle}</h2>
                <p className="text-slate-400 text-sm">{t.importDesc}</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-gold/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleImport}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file" className="cursor-pointer">
                <FileUp size={48} className="mx-auto text-slate-500 mb-4" />
                <p className="text-white font-medium mb-2">{t.selectFile}</p>
                <p className="text-slate-500 text-sm">{t.supportedFormats}</p>
              </label>
            </div>

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
