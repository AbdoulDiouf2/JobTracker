import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../contexts/AuthContext';

export function useDocuments() {
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get('/api/documents/').then(r => r.data),
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['documents', 'templates'],
    queryFn: () => api.get('/api/documents/templates/').then(r => r.data),
  });

  const invalidateDocs = () => queryClient.invalidateQueries({ queryKey: ['documents'] });

  const uploadDocument = useMutation({
    mutationFn: (formData) => api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
    onSuccess: invalidateDocs,
  });

  const createLink = useMutation({
    mutationFn: (data) => api.post('/api/documents/link', null, { params: data }).then(r => r.data),
    onSuccess: invalidateDocs,
  });

  const createTemplate = useMutation({
    mutationFn: (data) => api.post('/api/documents/templates', data).then(r => r.data),
    onSuccess: invalidateDocs,
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, data }) => api.put(`/api/documents/templates/${id}`, data).then(r => r.data),
    onSuccess: invalidateDocs,
  });

  const deleteDocument = useMutation({
    mutationFn: (documentId) => api.delete(`/api/documents/${documentId}`),
    onSuccess: invalidateDocs,
  });

  const deleteTemplate = useMutation({
    mutationFn: (templateId) => api.delete(`/api/documents/templates/${templateId}`),
    onSuccess: invalidateDocs,
  });

  const generateFromTemplate = async (templateId, entreprise, poste, applicationId = null) => {
    const response = await api.post(
      `/api/documents/templates/${templateId}/generate`,
      null,
      { params: { entreprise, poste, application_id: applicationId } }
    );
    return response.data;
  };

  const linkDocumentToApplication = async (applicationId, documentId) => {
    const response = await api.post('/api/documents/link-to-application', null, {
      params: { application_id: applicationId, document_id: documentId },
    });
    return response.data;
  };

  const getApplicationDocuments = async (applicationId) => {
    const response = await api.get(`/api/documents/application/${applicationId}`);
    return response.data;
  };

  const cvs = documents.filter(d => d.document_type === 'cv');
  const portfolioLinks = documents.filter(d => d.document_type === 'portfolio_link');
  const loading = docsLoading || templatesLoading;

  const getDefaultCV = () => cvs.find(cv => cv.is_default) || cvs[0] || null;
  const getDefaultTemplate = () => templates.find(t => t.is_default) || templates[0] || null;

  return {
    documents,
    cvs,
    templates,
    portfolioLinks,
    loading,
    uploadDocument,
    createLink,
    createTemplate,
    updateTemplate,
    deleteDocument,
    deleteTemplate,
    generateFromTemplate,
    linkDocumentToApplication,
    getApplicationDocuments,
    getDefaultCV,
    getDefaultTemplate,
  };
}
